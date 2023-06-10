from flask import request, jsonify
from .common.opendatasoft import query

def generate_handler(parameters):
    url = parameters["url"]
    dataset = parameters["dataset"]
    timestamp_field = parameters["timestamp_field"]
    location_field = parameters["location_field"]
    metric_fields = parameters["metric_fields"]
    def opendatasoft_history_handler():
        start = request.args.get("start")
        end = request.args.get("end")
        res = query(url, dataset, start, end, None, timestamp_field, location_field, metric_fields)
        return jsonify(res)
    return opendatasoft_history_handler
