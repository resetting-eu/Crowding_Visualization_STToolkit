from datetime import datetime
from urllib.request import urlopen
import json
import sys
from influxdb_client import Point

def init(parameters, write_points):
    url_prefix = parameters["url"]
    dataset = parameters["dataset"]
    timestamp_field = parameters["timestamp_field"]
    location_field = parameters["location_field"]
    metric_field = parameters["metric_field"]
    def ingest_from(start_timestamp):
        max_dt = datetime.fromisoformat(start_timestamp)
        url = generate_url(url_prefix, dataset, timestamp_field, start_timestamp, None)
        n_points = 0
        while url:
            try:
                records, url = fetch_records(url)
            except Exception as e:
                print(f"Error fetching: ${e}", file=sys.stderr)
                break
            points, max_dt = records_to_points(records, location_field, metric_field, timestamp_field)
            n_points += len(points)
            write_points(points)
        print(f"Wrote {n_points} points")
        return max_dt
    return ingest_from

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
    res = json.loads(urlopen(next_url).read())
    return [o["record"] for o in res["records"]], get_next_url(res)

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
