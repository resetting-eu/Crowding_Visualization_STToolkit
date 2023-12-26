from .common.influxdb import query
from .common.utils import parse_duration, parse_date, dt_to_string, uuid
from .common.data import empty_response
from datetime import datetime

# maps client_id to last obtained timestamp
clients_last_timestamp = {}

def generate_handler(parameters):
    url = parameters["url"]
    token = parameters["token"]
    org = parameters["org"]
    bucket = parameters["bucket"]
    metric_variable = parameters.get("metric_variable")
    location_variable = parameters["location_variable"]
    filters = parameters.get("filters")
    initial_time_offset = parameters["initial_time_offset"]
    interval = parameters["interval"]
    interval_td = parse_duration(interval)
    def influxdb_live_handler(args):
        client_id = args.get("client_id")
        last_timestamp = clients_last_timestamp.get(client_id)
        if not last_timestamp:
            initial_time_offset_td = parse_duration(initial_time_offset)
            start_dt = datetime.utcnow() - initial_time_offset_td
            start = dt_to_string(start_dt)
            res = query(url, token, org, bucket, start, None, location_variable, metric_variable, interval, None, filters)
            discard_last_timestamp(res)
            client_id = uuid()
            res["client_id"] = client_id
            clients_last_timestamp[client_id] = res["timestamps"][-1]
        else:
            last_timestamp_dt = parse_date(last_timestamp)
            if last_timestamp_dt + interval_td > datetime.utcnow():
                res = empty_response
            else:
                start = last_timestamp
                res = query(url, token, org, bucket, start, None, location_variable, metric_variable, interval, None, filters)
                keep_first_timestamp(res)
                clients_last_timestamp[client_id] = res["timestamps"][0]
        return res
    return influxdb_live_handler

def keep_first_timestamp(res):
    res["timestamps"] = [res["timestamps"][0]]
    for metric in res["values"]:
        for location in res["values"][metric]:
            res["values"][metric][location] = [res["values"][metric][location][0]]

def discard_last_timestamp(res):
    res["timestamps"] = res["timestamps"][:-1]
    for metric in res["values"]:
        for location in res["values"][metric]:
            res["values"][metric][location] = res["values"][metric][location][:-1]
