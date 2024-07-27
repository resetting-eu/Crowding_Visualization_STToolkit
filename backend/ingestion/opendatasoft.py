from datetime import datetime
from urllib.request import urlopen
import json
from influxdb_client import Point

def init(parameters):
    url_prefix = parameters["url"]
    dataset = parameters["dataset"]
    timestamp_field = parameters["timestamp_field"]
    location_field = parameters["location_field"]
    metric_field = parameters["metric_field"]
    def fetch_from(start_timestamp):
        url = generate_url(url_prefix, dataset, timestamp_field, start_timestamp, None)
        records = fetch_records(url)
        points, max_dt = records_to_points(records, location_field, metric_field, timestamp_field)
        return points, max_dt
    return fetch_from

def records_to_points(records, location_field, metric_field, timestamp_field):
    points = []
    max_dt = datetime.fromisoformat("1900-01-01T00:00:00+00:00")
    for record in records:
        point, dt = record_to_point(record, location_field, metric_field, timestamp_field)
        points.append(point)
        if dt > max_dt:
            max_dt = dt
    return points, max_dt

def record_to_point(record, location_field, metric_field, timestamp_field):
    fields = record["fields"]
    timestamp = fields[timestamp_field]
    dt = datetime.fromisoformat(timestamp)
    loc_id = fields[location_field]
    value = fields[metric_field]

    return (Point(loc_id)
                .tag("metric", metric_field)
                .field("_value", value)
                .time(dt),
            dt)




# the following is copied from backend.connectors.common.opendatasoft
# this is because I'm having trouble with relative imports

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
