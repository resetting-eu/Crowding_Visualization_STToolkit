from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
import enum

db = SQLAlchemy()

class Role(enum.Enum):
    superuser = 1
    admin = 2
    regular = 3

class User(db.Model, UserMixin):
    email = db.Column(db.String(255), primary_key=True)
    unique_token = db.Column(db.String(255), unique=True)
    name = db.Column(db.String(255), nullable=False)
    pwd_hash = db.Column(db.String(255))
    validation_hash = db.Column(db.String(255))
    role = db.Column(db.Enum(Role))
    last_activity = db.Column(db.DateTime)

    def get_id(self):
        return self.unique_token

