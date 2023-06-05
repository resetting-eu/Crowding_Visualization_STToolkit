from flask import request, jsonify
from .common.opendatasoft import fetch_records
from .common.utils import parse_duration, dt_to_string, array_put_at, uuid, array_pad
from datetime import datetime

clients_info = {}

def generate_handler(parameters):
    url = parameters["url"]
    dataset = parameters["dataset"]
    timestamp_field = parameters["timestamp_field"]
    location_field = parameters["location_field"]
    initial_time_offset = parse_duration(parameters["initial_time_offset"])
    metric_fields = parameters["metric_fields"]
    max_buffer_size = parameters["max_buffer_size"]
    def opendatasoft_live_handler():
        client_id = request.args.get("client_id")
        client_info = clients_info.get(client_id)
        now_minus_offset = dt_to_string(datetime.utcnow() - initial_time_offset)
        if client_info:
            max_record_timestamp = client_info["max_record_timestamp"]
            timestamps = client_info["timestamps"]
            if len(timestamps) > 0:
                first_timestamp = timestamps[0]
            else:
                first_timestamp = now_minus_offset
        else:
            max_record_timestamp = now_minus_offset
            first_timestamp = now_minus_offset
        res = get_values(max_record_timestamp, first_timestamp, url, dataset, timestamp_field, location_field, metric_fields)
        if not client_info:
            client_id = uuid()
            res["client_id"] = client_id
            clients_info[client_id] = {}
            clients_info[client_id]["timestamps"] = []
            if len(res["timestamps"]) > 0: # check data was actually returned from external endpoint
                max_record_timestamp = res["max_record_timestamp"]
        clients_info[client_id]["max_record_timestamp"] = max_record_timestamp
        clients_info[client_id]["timestamps"] = cap_timestamps(clients_info[client_id]["timestamps"], res["timestamps"], max_buffer_size)
        if len(clients_info[client_id]["timestamps"]) > 0:
            cap_res(res, clients_info[client_id]["timestamps"][0])
        return jsonify(res)
    return opendatasoft_live_handler

def get_values(max_record_timestamp, first_timestamp, url_prefix, dataset, timestamp_field, location_field, metric_fields):
    url = generate_url(first_timestamp, url_prefix, dataset, timestamp_field)
    timestamps = set()
    values = {}
    for metric_name in metric_fields:
        values[metric_name] = {}
    current_timestamp = "1900-01-01T00:00:00Z"
    current_timestamp_index = -1
    new_max_record_timestamp = max_record_timestamp
    for record in fetch_records(url):
        record_timestamp = record["timestamp"]
        if record_timestamp < max_record_timestamp:
            continue # record was processed in a previous invocation
        if record_timestamp > new_max_record_timestamp:
            new_max_record_timestamp = record_timestamp
        fields = record["fields"]
        timestamp = fields[timestamp_field]
        timestamps.add(timestamp)
        if timestamp > current_timestamp:
            current_timestamp = timestamp
            current_timestamp_index += 1
        location = fields[location_field]
        for metric_name in metric_fields:
            value = fields.get(metric_name)
            if value:
                if location not in values[metric_name]:
                    values[metric_name][location] = []
                array_put_at(values[metric_name][location], current_timestamp_index, value)
    pad_values(values, len(timestamps))
    sorted_timestamps = sorted(timestamps)
    return {"timestamps": sorted_timestamps, "values": values, "max_record_timestamp": new_max_record_timestamp}

def generate_url(first_timestamp, url_prefix, dataset, timestamp_field):
    first_timestamp = first_timestamp.replace("+00:00", "Z")
    limit = 100
    order_by = "{}%20asc".format(timestamp_field)
    where = "{}>=date'{}'".format(timestamp_field, first_timestamp)
    url = url_prefix + "/catalog/datasets/" + dataset
    url += "/records?order_by={}&where={}&limit={}".format(order_by, where, limit)
    return url

def pad_values(values, length):
    for metric_name in values:
        for location in values[metric_name]:
            array_pad(values[metric_name][location], length)

def cap_timestamps(saved_timestamps, res_timestamps, max_buffer_size):
    timestamps = set()
    for timestamp in saved_timestamps:
        timestamps.add(timestamp)
    for timestamp in res_timestamps:
        timestamps.add(timestamp)
    sorted_timestamps = sorted(timestamps)
    return sorted_timestamps[-max_buffer_size:]

def cap_res(res, first_timestamp):
    first_timestamp_index = res["timestamps"].index(first_timestamp)
    res["timestamps"] = res["timestamps"][first_timestamp_index:]
    for metric_name in res["values"]:
        for location in res["values"][metric_name]:
            res["values"][metric_name][location] = res["values"][metric_name][location][first_timestamp_index:]
