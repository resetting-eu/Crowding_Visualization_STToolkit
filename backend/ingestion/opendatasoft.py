from datetime import datetime
from urllib.request import urlopen
import io
import csv
import sys
from influxdb_client import Point

def init(parameters, write_points):
    url_prefix = parameters["url"]
    dataset = parameters["dataset"]
    timestamp_field = parameters["timestamp_field"]
    location_field = parameters["location_field"]
    metric_field = parameters["metric_field"]
    def ingest_from(start_timestamp):
        url = csv_url(url_prefix, dataset, timestamp_field, start_timestamp)
        try:
            csv_str = urlopen(url).read().decode("utf-8")
            points, max_dt = csv_str_to_points(csv_str, location_field, metric_field, timestamp_field, start_timestamp)
            write_points(points)
            print(f"Wrote {len(points)} points")
            return max_dt
        except Exception as e:
            print(f"Error fetching: ${e}", file=sys.stderr)
    return ingest_from

def csv_str_to_points(csv_str, location_field, metric_field, timestamp_field, first_timestamp):
    f = io.StringIO(csv_str)
    reader = csv.reader(f, delimiter=";")
    header = next(reader)
    location_field_i = header.index(location_field)
    metric_field_i = header.index(metric_field)
    timestamp_field_i = header.index(timestamp_field)
    points = []
    max_dt = datetime.fromisoformat(first_timestamp)
    for row in reader:
        dt = datetime.fromisoformat(row[timestamp_field_i])
        points.append(Point(row[location_field_i])
                .tag("metric", metric_field)
                .field("_value", int(row[metric_field_i]))
                .time(dt))
        if dt > max_dt:
            max_dt = dt
    return points, max_dt

def csv_url(url_prefix, dataset, timestamp_field, first_timestamp):
    where = ""
    if first_timestamp:
        first_timestamp = first_timestamp.replace("+00:00", "Z")
        where = "&where={}>=date'{}'".format(timestamp_field, first_timestamp)
    order_by = "{}%20asc".format(timestamp_field)
    url = url_prefix + "/catalog/datasets/" + dataset + "/exports/csv"
    url += "?order_by={}{}".format(order_by, where)
    return url
