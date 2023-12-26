import json

def generate_handler(parameters):
    path = parameters["path"]
    def static_handler(_):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    return static_handler
