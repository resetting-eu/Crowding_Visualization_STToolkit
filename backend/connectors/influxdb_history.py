from flask import request, jsonify
from .common.influxdb import query

# "1,2" -> [1,2]
def commas_to_list(s):
    return s.split(",") if s else None

def generate_handler(parameters):
    url = parameters["url"]
    token = parameters["token"]
    org = parameters["org"]
    bucket = parameters["bucket"]
    metric_variable = parameters.get("metric_variable")
    location_variable = parameters["location_variable"]
    filters = parameters.get("filters")
    def influxdb_history_handler():
        start = request.args.get("start")
        end = request.args.get("end")
        every = request.args.get("every")
        locations = commas_to_list(request.args.get("locations"))
        res = query(url, token, org, bucket, start, end, location_variable, metric_variable, every, locations, filters)
        return jsonify(res)
    return influxdb_history_handler
