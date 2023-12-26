from flask import Flask, jsonify, request
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from sqlalchemy.exc import IntegrityError
from importlib import import_module
from os import listdir, environ
import yaml
from yaml.loader import SafeLoader
import json
import re
from datetime import datetime
from uuid import uuid4
from time import perf_counter
import sys

config_file = environ["CONFIG"] if "CONFIG" in environ else "config.yml"
with open(config_file, encoding="utf-8") as f:
    cfg = yaml.load(f.read(), Loader=SafeLoader) # TODO mudar Loader
cfg_auth = cfg["auth"]
del cfg["auth"]

app = Flask(__name__)

LOCAL_ENV = environ.get("ENV") == "local"

if LOCAL_ENV:
    app.config["CORS_ORIGINS"] = "http://localhost:3000"
    app.config["CORS_SUPPORTS_CREDENTIALS"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "None"
    LIMITER_STORAGE_URI = "memory://"
    from .parse_derived_metrics import add_derived_metrics
    from .db_model import db, User, Role
    from .hash import gen_hash, check_hash
    from .send_email import send_email
else:
    app.config["SESSION_COOKIE_SECURE"] = True
    LIMITER_STORAGE_URI = "memcached://memcached:11211"
    from parse_derived_metrics import add_derived_metrics
    from db_model import db, User, Role
    from hash import gen_hash, check_hash
    from send_email import send_email

app.config["SECRET_KEY"] = cfg_auth["secret_key"]
app.config["SQLALCHEMY_DATABASE_URI"] = cfg_auth["database_uri"]

if LOCAL_ENV:
    from flask_cors import CORS
    CORS(app)

limiter = Limiter(
    get_remote_address,
    app=app,
    storage_uri=LIMITER_STORAGE_URI
)

login_manager = LoginManager(app)

db.init_app(app)

### common responses
def response_ok():
    return jsonify({'message': 'Ok'})

def response_unauthorized():
    return jsonify({'message': 'Unauthorized'}), 401

def response_not_exists():
    return jsonify({'message': 'User does not exist'}), 404


@app.errorhandler(429)
def too_many_requests(_):
    return jsonify({'message': 'Too many requests'}), 429

@login_manager.user_loader
def load_user(user_id):
    user = db.session.scalars(db.select(User).where(User.unique_token == user_id)).first()
    if user:
        user.last_activity = datetime.now()
        db.session.commit()
    return user

@login_manager.unauthorized_handler
def unauthorized_handler():
    return response_unauthorized()

@app.route('/auth/login', methods=['POST'])
@limiter.limit("5 per day", deduct_when=lambda res: res.status_code != 200)
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = db.session.get(User, email)
    if not user or not check_hash(password, user.pwd_hash):
        return jsonify({'message': 'Invalid email or password'}), 401

    login_user(user)
    return jsonify({'message': 'Logged in successfully'})

@app.route('/auth/logout')
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'})



def is_valid_email(email):
   match = re.match(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}$", email)
   return bool(match)

def create_first_user():
    email = cfg_auth.get("initial_user") or "admin"
    password = cfg_auth.get("initial_password") or "admin"
    user = User(email=email, role=Role.superuser, pwd_hash=gen_hash(password), unique_token=str(uuid4()), name="root")
    db.session.add(user)
    db.session.commit()

def send_activation_email(uuid, email):    
    subject = "crowdingVisualization activation link"
    body = "Activation link: http://localhost:3000/activate?email={}&uuid={}".format(email, uuid)
    sender = cfg_auth["email_sender"]
    password = cfg_auth["email_password"]
    send_email(subject, body, sender, email, password)

def is_admin(user):
    return user.role in (Role.superuser, Role.admin)

@app.route('/auth/user', methods=['POST'])
@login_required
def create():
    if current_user.role not in (Role.admin, Role.superuser):
        return response_unauthorized()

    data = request.get_json()
    email = data.get('email')
    is_admin = data.get('is_admin')
    name = data.get('name')

    if not is_valid_email(email):
        return jsonify({'message': 'Invalid email'}), 400
    
    if not name:
        return jsonify({'message': 'Missing name'}), 400

    user = db.session.get(User, email)
    if user:
        return jsonify({"message": "Email already registered"}), 400

    role=Role.admin if is_admin else Role.regular
    if role == Role.admin and current_user.role != Role.superuser:
        return response_unauthorized()

    new_uuid = str(uuid4())
    uuid_hash = gen_hash(new_uuid)

    user_to_activate = User(email=email, role=role, validation_hash=uuid_hash, name=name)
    db.session.add(user_to_activate)
    db.session.commit()
    
    send_activation_email(new_uuid, email)

    return response_ok()

@app.route('/auth/user', methods=['DELETE'])
@login_required
def delete_user():
    data = request.get_json()
    email = data.get('email')

    user = db.session.get(User, email)
    if not is_admin(current_user) and user != current_user: # regular user can only delete itself
        return response_unauthorized()
    if not user:
        return response_not_exists()
    if user.role == Role.superuser:
        return jsonify({"message": "Cannot delete superuser"}), 401

    db.session.delete(user)
    db.session.commit()

    return response_ok()

@app.route('/auth/password', methods=['PUT'])
@login_required
def change_password():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    user = db.session.get(User, email)

    if not user or not user.unique_token or user != current_user:
        return response_not_exists()
    
    if password is not None:
        pwd_hash = gen_hash(password)
    else:
        pwd_hash = user.pwd_hash

    while True:
        try:
            user.pwd_hash = pwd_hash
            user.unique_token = str(uuid4())
            db.session.commit()
            
            logout_user()
            return response_ok()
        except IntegrityError:
            db.session.rollback()

@app.route('/auth/role', methods=['PUT'])
@login_required
def change_role():
    data = request.get_json()
    email = data.get('email')
    is_admin = data.get('is_admin')

    if current_user.role != Role.superuser:
        return response_unauthorized()
    
    user = db.session.get(User, email)
    if not user or not user.unique_token:
        return response_not_exists()

    if user.role == Role.superuser:
        return jsonify("Cannot change superuser role"), 400
    
    user.role = Role.admin if is_admin else Role.regular
    db.session.commit()
    
    return response_ok()

@app.route('/auth/activate', methods=['POST'])
@limiter.limit("5 per day", deduct_when=lambda res: res.status_code != 200)
def activate_user():
    data = request.get_json()
    email = data.get('email')
    uuid = data.get('uuid')
    password = data.get('password')

    user_to_activate = db.session.get(User, email)
    if not user_to_activate or not user_to_activate.validation_hash or not check_hash(uuid, user_to_activate.validation_hash):
        return response_not_exists()
    
    pwd_hash = gen_hash(password)
    while True: # loop until generated uuid is unique
        try:
            user_to_activate.pwd_hash = pwd_hash
            user_to_activate.validation_hash = None
            user_to_activate.unique_token = str(uuid4())
            db.session.commit()
            return response_ok()
        except IntegrityError:
            db.session.rollback()

@app.route('/auth/forgot_password', methods=['POST'])
@limiter.limit("5 per day")
def forgot_password():
    data = request.get_json()
    email = data.get('email')

    user = db.session.get(User, email)

    if user is None or user.validation_hash is not None:
        return jsonify({'message': 'Invalid operation'}), 400 # TODO maybe think of a better message / code

    uuid = str(uuid4())
    user.validation_hash = gen_hash(uuid)
    db.session.commit()

    send_activation_email(uuid, email)

    return response_ok()

@app.route('/auth/user_info')
@login_required
def roles():
    return jsonify({'email': current_user.email, 'role': current_user.role.name})

@app.route('/auth/user_list')
@login_required
def user_list():
    if not is_admin(current_user):
        return response_unauthorized()
    
    res = []
    users = db.session.scalars(db.select(User).where(User.unique_token != None))
    for user in users:
        res.append({'email': user.email, 'role': user.role.name, 'name': user.name})
    return jsonify(res)

# maps connector name to closure that generates the handler
connectors = {}

# wrapper handler for derived metrics
def derived_metrics_handler(handler, derived_metrics):
    def wrapped_handler(args):
        start_time = perf_counter()
        res = handler(args)
        add_derived_metrics(res, derived_metrics)
        end_time = perf_counter()
        print("backend total, minus jsonify: {}".format(end_time - start_time), file=sys.stderr)
        return res
    return wrapped_handler


def time_endpoint(f):
    def timed_handler(args):
        start_time = perf_counter()
        res = f(args)
        end_time = perf_counter()
        print("backend total: {}".format(end_time - start_time), file=sys.stderr)
        return res
    return timed_handler

### Code to be executed on load

# create database tables, if they don't exist
with app.app_context():
    db.create_all()
    has_users = db.session.execute(db.select(User)).first() is not None
    if not has_users:
        create_first_user()

# import connector modules
def import_connector(name):
    if name in connectors:
        return connectors[name]

    for file in listdir("connectors"):
        basename = file[:-3]
        if basename == name and file.endswith(".py"):
            if LOCAL_ENV:
                module = import_module("." + basename, "backend.connectors")
            else:
                module = import_module("connectors." + basename)
            connectors[name] = module.generate_handler
            return connectors[name]

# generates the actual handler function that is configured in flask
def generate_flask_handler(f):
    def actual_handler():
        res = f(request.args)
        return jsonify(res)
    return actual_handler

def configure_metadata_handler_make_handler(name):
    this_cfg = cfg["metadata"][name]
    connector = import_connector(this_cfg["connector"])
    handler = connector(this_cfg["parameters"])
    handler = time_endpoint(handler)
    return handler

def configure_metadata_handler():
    locations_handler = configure_metadata_handler_make_handler("locations")
    parishes_handler = configure_metadata_handler_make_handler("parishes")
    def metadata_handler(args):
        res = {}
        res["locations"] = locations_handler(args)
        res["parishes"] = parishes_handler(args)
        for x in cfg["metadata"]:
            if x != "locations" and x != "parishes":
                res[x] = cfg["metadata"][x]
        return res
    handler = generate_flask_handler(metadata_handler)
    handler = login_required(handler)
    app.add_url_rule("/metadata", view_func=handler)

# instantiate endpoints as defined in configuration file
for name in cfg:
    assert name == "history" or name == "live" or name == "metadata" # TODO verificar que metadata existe e pelo menos um de (history,locations) existe e que não há repetições
    if name == "metadata":
        configure_metadata_handler()
    else:
        connector = import_connector(cfg[name]["connector"])
        handler = connector(cfg[name]["parameters"])
        derived_metrics = cfg[name].get("derived_metrics")
        if derived_metrics:
            handler = derived_metrics_handler(handler, derived_metrics)
        handler = time_endpoint(handler)
        handler = generate_flask_handler(handler)
        handler = login_required(handler)
        handler.__name__ = handler.__name__ + "_" + name # flask requires handler functions to have unique names
        app.add_url_rule('/' + name, view_func=handler)
