from .common.influxdb import query, query_last_timestamp
from .common.utils import parse_duration
from datetime import datetime

def generate_handler(parameters):
    url = parameters["url"]
    token = parameters["token"]
    org = parameters["org"]
    bucket = parameters["bucket"]
    metric_variable = parameters.get("metric_variable")
    location_variable = parameters["location_variable"]
    filters = parameters.get("filters")
    offset = parameters["offset"]
    offset_td = parse_duration(offset)
    interval = parameters["interval"]
    def influxdb_live_handler(_):
        last_timestamp_in_bucket = query_last_timestamp(url, token, org, bucket, "-30d", location_variable, None, filters)
        last_dt_in_bucket = datetime.fromisoformat(last_timestamp_in_bucket.replace("Z", "+00:00"))
        start_dt = last_dt_in_bucket - offset_td
        start = start_dt.isoformat()
        res = query(url, token, org, bucket, start, None, location_variable, metric_variable, interval, None, filters)
        return res
    return influxdb_live_handler
