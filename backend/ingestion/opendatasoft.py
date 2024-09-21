from datetime import datetime, timedelta
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
    ignore_before = parameters["ignore_before"]
    def ingest_from(start_timestamp):
        url = csv_url(url_prefix, dataset, timestamp_field, start_timestamp)
        try:
            start_timestamp = actual_first_timestamp(start_timestamp, ignore_before)
            csv_str = urlopen(url).read().decode("utf-8")
            max_dt = csv_str_to_points_and_push(csv_str, location_field, metric_field, timestamp_field, start_timestamp, write_points)
            return max_dt
        except Exception as e:
            print(f"Error fetching: ${e}", file=sys.stderr)
    return ingest_from

def load_historical(parameters, write_points):
    url_prefix = parameters["url"]
    dataset = parameters["dataset"]
    timestamp_field = parameters["timestamp_field"]
    location_field = parameters["location_field"]
    metric_field = parameters["metric_field"]
    def ingest_from(start_timestamp, end_timestamp):
        url = csv_url(url_prefix, dataset, timestamp_field, start_timestamp, end_timestamp)
        try:
            csv_str = urlopen(url).read().decode("utf-8")
            max_dt = csv_str_to_points_and_push(csv_str, location_field, metric_field, timestamp_field, start_timestamp, write_points)
            return max_dt
        except Exception as e:
            print(f"Error fetching: ${e}", file=sys.stderr)
    return ingest_from

def csv_str_to_points_and_push(csv_str, location_field, metric_field, timestamp_field, first_timestamp, write_points):
    f = io.StringIO(csv_str)
    reader = csv.reader(f, delimiter=";")
    header = next(reader)
    location_field_i = header.index(location_field)
    metric_field_i = header.index(metric_field)
    timestamp_field_i = header.index(timestamp_field)
    total_points = 0
    points = []
    max_dt = first_timestamp
    for row in reader:
        dt = datetime.fromisoformat(row[timestamp_field_i])
        points.append(Point(row[location_field_i])
                .tag("metric", metric_field)
                .field("_value", int(row[metric_field_i]))
                .time(dt))
        total_points += 1
        if dt > max_dt:
            max_dt = dt
        if len(points) >= 1000:
            write_points(points)
            points = []
    print(f"Wrote {total_points} points")
    return max_dt

def csv_url(url_prefix, dataset, timestamp_field, first_timestamp, last_timestamp=None):
    conditions = []
    if first_timestamp:
        first_timestamp = first_timestamp.replace("+00:00", "Z")
        conditions.append("{}>=date'{}'".format(timestamp_field, first_timestamp))
    if last_timestamp:
        last_timestamp = last_timestamp.replace("+00:00", "Z")
        conditions.append("{}<=date'{}'".format(timestamp_field, last_timestamp))
    where = "%20and%20".join(conditions)
    order_by = "{}%20asc".format(timestamp_field)
    url = url_prefix + "/catalog/datasets/" + dataset + "/exports/csv"
    url += "?order_by={}&where={}".format(order_by, where)
    return url

def actual_first_timestamp(first_timestamp, ignore_before):
    """Go back in time from first_timestamp by ignore_before units of time (unless first_timestamp is older)"""
    date1 = datetime.fromisoformat(first_timestamp)
    date2 = date1 - parse_duration(ignore_before)
    return date1 if date1 > date2 else date2

def parse_duration(duration):
    """parses string in 'xu' format, where x is an int and u is one of (m, h, d, w)"""
    
    n = int(duration[:-1])
    u = duration[-1]
    assert u in ["m", "h", "d", "w"]
    if u == "m":
        return timedelta(minutes=n)
    elif u == "h":
        return timedelta(hours=n)
    elif u == "d":
        return timedelta(days=n)
    elif u == "w":
        return timedelta(weeks=n)
