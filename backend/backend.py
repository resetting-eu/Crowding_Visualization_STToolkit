from flask import Flask
from flask_cors import CORS
from importlib import import_module
from os import listdir, environ
import yaml
from yaml.loader import SafeLoader

app = Flask(__name__)
CORS(app)

# maps connector name to closure that generates the handler
connectors = {}

# import connector modules
for file in listdir("connectors"):
    if file[-3:] == ".py" and file != "__init__.py":
        basename = file[:-3]
        module = import_module("connectors." + basename)
        connectors[basename] = module.generate_handler

# instantiate endpoints as defined in configuration file
config_file = environ["CONFIG"] if "CONFIG" in environ else "config.yml"
with open(config_file, encoding="utf-8") as f:
    cfg = yaml.load(f.read(), Loader=SafeLoader) # TODO mudar Loader
    for name in cfg:
        assert name == "history" or name == "live" or name == "locations" # TODO verificar que locations existe e pelo menos um de (history,locations) existe e que não há repetições
        connector = connectors[cfg[name]["connector"]]
        handler = connector(cfg[name]["parameters"])
        app.add_url_rule('/' + name, view_func=handler)
