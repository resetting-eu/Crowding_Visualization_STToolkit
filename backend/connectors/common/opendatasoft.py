from urllib.request import urlopen
import json
from .utils import array_put_at, array_pad

def fetch_records(url):
    next_url = url
    while next_url:
        res = json.loads(urlopen(next_url).read())
        for element in res["records"]:
            yield element["record"]
        next_url = get_next_url(res)

def get_next_url(res):
    for link in res["links"]:
        if link["rel"] == "next":
            return link["href"]

def query(url_prefix, dataset, first_timestamp, last_timestamp, max_record_timestamp, timestamp_field, location_field, metric_fields):
    url = generate_url(url_prefix, dataset, timestamp_field, first_timestamp, last_timestamp)
    timestamps = set()
    values = {}
    for metric_name in metric_fields:
        values[metric_name] = {}
    current_timestamp = "1900-01-01T00:00:00Z"
    current_timestamp_index = -1
    new_max_record_timestamp = max_record_timestamp
    for record in fetch_records(url):
        record_timestamp = record["timestamp"]
        if max_record_timestamp and record_timestamp <= max_record_timestamp:
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
        put_value(fields, values, location, metric_fields, current_timestamp_index)
    pad_values(values, len(timestamps))
    sorted_timestamps = sorted(timestamps)
    return {"timestamps": sorted_timestamps, "values": values, "max_record_timestamp": new_max_record_timestamp}

def put_value(fields, values, location, metric_fields, index):
    for metric_name in metric_fields:
        value = fields.get(metric_name)
        if value:
            if location not in values[metric_name]:
                values[metric_name][location] = []
            array_put_at(values[metric_name][location], index, value)

def pad_values(values, length):
    for metric_name in values:
        for location in values[metric_name]:
            array_pad(values[metric_name][location], length)

def generate_url(url_prefix, dataset, timestamp_field, first_timestamp, last_timestamp):
    conditions = []
    if first_timestamp:
        first_timestamp = first_timestamp.replace("+00:00", "Z")
        conditions.append("{}>=date'{}'".format(timestamp_field, first_timestamp))
    if last_timestamp:
        last_timestamp = last_timestamp.replace("+00:00", "Z")
        conditions.append("{}<=date'{}'".format(timestamp_field, last_timestamp))
    where = "%20and%20".join(conditions)
    limit = 100
    order_by = "{}%20asc".format(timestamp_field)
    url = url_prefix + "/catalog/datasets/" + dataset
    url += "/records?order_by={}&where={}&limit={}".format(order_by, where, limit)
    return url
