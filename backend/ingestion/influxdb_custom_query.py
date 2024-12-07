import influxdb_client
from datetime import timedelta, datetime

def init(parameters, write_points):
    url = parameters["url"]
    token = parameters["token"]
    org = parameters["org"]
    query_str_template = parameters["query"]
    location_variable = parameters["location_variable"]
    ignore_before = parameters.get("ignore_before")
    def ingest_from(start_timestamp):
        start = datetime.fromisoformat(start_timestamp)
        if ignore_before:
            start = start - parse_duration(ignore_before)
        query_str = query_str_template.replace("START", start.isoformat())
        with influxdb_client.InfluxDBClient(url=url, token=token, org=org, debug=False) as client:
            query_api = client.query_api()
            tables = query_api.query(query_str)
            points = []
            max_dt = start
            for table in tables:
                for record in table.records:
                    # TODO be metric-aware
                    dt = record.values["_time"]
                    points.append(influxdb_client.Point(record.values[location_variable])
                        .tag("metric", "all")
                        .field("_value", record.values["_value"])
                        .time(dt))
                    if dt > max_dt:
                        max_dt = dt
        write_points(points)
        print(f"Wrote {len(points)} points")
        return dt
    return ingest_from

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

# TODO historic mode
