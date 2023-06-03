from flask import request, jsonify
from .common.opendatasoft import fetch_records
from .common.utils import parse_duration, dt_to_string, array_put_at, uuid
from datetime import datetime

clients_last_timestamp = {}

def generate_handler(parameters):
    url = parameters["url"]
    dataset = parameters["dataset"]
    timestamp_field = parameters["timestamp_field"]
    location_field = parameters["location_field"]
    initial_time_offset = parse_duration(parameters["initial_time_offset"])
    metric_fields = parameters["metric_fields"]
    def opendatasoft_live_handler():
        client_id = request.args.get("client_id")
        last_timestamp = clients_last_timestamp.get(client_id)
        res = get_values(last_timestamp, url, dataset, timestamp_field, location_field, initial_time_offset, metric_fields)
        if not last_timestamp:
            client_id = uuid()
            res["client_id"] = client_id
            if len(res["timestamps"]) > 0: # check for case where no data was returned from the external endpoint
                clients_last_timestamp[client_id] = res["timestamps"][-1] 
            else:
                clients_last_timestamp[client_id] = dt_to_string(datetime.utcnow() - initial_time_offset)
        return jsonify(res)
    return opendatasoft_live_handler

def get_values(last_timestamp, url_prefix, dataset, timestamp_field, location_field, initial_time_offset, metric_fields):
    url = generate_url(last_timestamp, url_prefix, dataset, timestamp_field, initial_time_offset)
    timestamps = set()
    values = {}
    for metric_name in metric_fields:
        values[metric_name] = {}
    current_timestamp = "1900-01-01T00:00:00Z"
    current_timestamp_index = -1
    for record in fetch_records(url):
        fields = record["fields"]
        timestamp = fields[timestamp_field]
        timestamps.add(timestamp)
        if timestamp > current_timestamp:
            current_timestamp = timestamp
            current_timestamp_index += 1
        location = fields[location_field]
        for metric_name in metric_fields:
            value = fields.get(metric_name)
            if not value:
                continue
            if location not in values[metric_name]:
                values[metric_name][location] = []
            array_put_at(values[metric_name][location], current_timestamp_index, value)
    sorted_timestamps = sorted(timestamps)
    return {"timestamps": sorted_timestamps, "values": values}

def generate_url(last_timestamp, url_prefix, dataset, timestamp_field, initial_time_offset):
    if last_timestamp:
        start = last_timestamp.replace("+00:00", "Z")
    else:
        start_dt = datetime.utcnow() - initial_time_offset
        start = dt_to_string(start_dt)
    limit = 100
    order_by = "{}%20asc".format(timestamp_field)
    where = "{}>date'{}'".format(timestamp_field, start)
    url = url_prefix + "/catalog/datasets/" + dataset
    url += "/records?order_by={}&where={}&limit={}".format(order_by, where, limit)
    return url
