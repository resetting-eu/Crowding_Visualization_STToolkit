from flask import jsonify
from .common.opendatasoft import fetch_records
from .common.utils import parse_duration, dt_to_string, array_put_at
from datetime import datetime

def generate_handler(parameters):
    url = parameters["url"]
    dataset = parameters["dataset"]
    timestamp_field = parameters["timestamp_field"]
    location_field = parameters["location_field"]
    initial_time_offset = parse_duration(parameters["initial_time_offset"])
    metric_fields = parameters["metric_fields"]
    def opendatasoft_live_handler():
        res = get_values(url, dataset, timestamp_field, location_field, initial_time_offset, metric_fields)
        return jsonify(res)
    return opendatasoft_live_handler

def get_values(url_prefix, dataset, timestamp_field, location_field, initial_time_offset, metric_fields):
    url = generate_url(url_prefix, dataset, timestamp_field, initial_time_offset)
    timestamps = set()
    values = {}
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
            if metric_name not in values:
                values[metric_name] = {}
            if location not in values[metric_name]:
                values[metric_name][location] = []
            array_put_at(values[metric_name][location], current_timestamp_index, value)
    sorted_timestamps = sorted(timestamps)
    return {"timestamps": sorted_timestamps, "values": values}

def generate_url(url_prefix, dataset, timestamp_field, initial_time_offset):
    start_dt = datetime.utcnow() - initial_time_offset
    start = dt_to_string(start_dt)
    limit = 100
    order_by = "{}%20asc".format(timestamp_field)
    where = "{}>=date'{}'".format(timestamp_field, start)
    url = url_prefix + "/catalog/datasets/" + dataset
    url += "/records?order_by={}&where={}&limit={}".format(order_by, where, limit)
    return url
