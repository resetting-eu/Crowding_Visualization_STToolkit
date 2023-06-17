from flask import Flask, jsonify, request
from flask_cors import CORS
from importlib import import_module
from os import listdir, environ
import yaml
from yaml.loader import SafeLoader
import json
from .parse_derived_metrics import add_derived_metrics

app = Flask(__name__)
CORS(app)

# maps connector name to closure that generates the handler
connectors = {}

# import connector modules
for file in listdir("connectors"):
    if file[-3:] == ".py" and file != "__init__.py":
        basename = file[:-3]
        module = import_module("." + basename, "backend.connectors")
        connectors[basename] = module.generate_handler

# wrapper handler for derived metrics
# TODO -- handlers should return res object instead of jsonified value, so that the wrappers don't need to parse the json
def derived_metrics_handler(handler, derived_metrics):
    def wrapped_handler():
        res = json.loads(handler().get_data()) # inefficient: jsonify, parse, jsonify
        add_derived_metrics(res, derived_metrics)
        return jsonify(res)
    # it is necessary to change the function's name if there is more than 1 wrapped handler configured
    wrapped_handler.__name__ = handler.__name__ + "_with_derived_metrics"
    return wrapped_handler

# instantiate endpoints as defined in configuration file
config_file = environ["CONFIG"] if "CONFIG" in environ else "config.yml"
with open(config_file, encoding="utf-8") as f:
    cfg = yaml.load(f.read(), Loader=SafeLoader) # TODO mudar Loader
    for name in cfg:
        assert name == "history" or name == "live" or name == "locations" # TODO verificar que locations existe e pelo menos um de (history,locations) existe e que não há repetições
        connector = connectors[cfg[name]["connector"]]
        handler = connector(cfg[name]["parameters"])
        derived_metrics = cfg[name].get("derived_metrics")
        if derived_metrics:
            handler = derived_metrics_handler(handler, derived_metrics)
        app.add_url_rule('/' + name, view_func=handler)
