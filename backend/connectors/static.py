import json
import sys

def generate_handler(parameters):
    path = parameters["path"]
    print(f"Loading {path}", file=sys.stderr)
    with open(path, encoding="utf-8") as f:
        res = json.load(f)
    def static_handler(_):
        return res
    return static_handler
