import influxdb_client
from time import perf_counter
import sys

def query_range_str(bucket, start, end, every, locations, location_variable, filters):
    # TODO usar bind parameters em vez de espetar os params diretamente na query string
    res = 'from(bucket: "' + bucket + '")\
        |> range(start: ' + start + (', stop: ' + end if end else '') + ')'
    if filters:
        for filter in filters:
            res += '|> filter(fn: ' + filter + ')'
    if locations:
        locations_regex = '|'.join(map(lambda l: "^" + str(l) + "$", locations))
        res += '|> filter(fn: (r) => r["' + location_variable + '"] =~ /' + locations_regex + '/)'
    if every:
        res += '|> aggregateWindow(every: ' + every + ', fn: mean, createEmpty: false)'
    return res

def append_value(values, record, metric_variable, location_variable):
    location_id = record.values[location_variable]
    value = record.values["_value"]

    if metric_variable:
        metric = record.values[metric_variable]
        if metric not in values:
            assert metric != "None" and metric != "Density" # reserved metric names for frontend
            values[metric] = {}
        metric_obj = values[metric]
        if location_id not in metric_obj:
            metric_obj[location_id] = []
        metric_obj[location_id].append(value)
    else:
        if location_id not in values:
            values[location_id] = []
        values[location_id].append(value)

def query(url, token, org, bucket, start, end, location_variable, metric_variable=None, every=None, locations=[], filters=[]):
    with influxdb_client.InfluxDBClient(url=url, token=token, org=org, debug=False) as client:
        query_api = client.query_api()
        query_str = query_range_str(bucket, start, end, every, locations, location_variable, filters)
        start_time = perf_counter()
        tables = query_api.query(query_str)
        end_time = perf_counter()
        print("query time: {}".format(end_time - start_time), file=sys.stderr)
        timestamps = set()
        values = {}
        for table in tables:
            for record in table.records:
                timestamp = record.values["_time"].isoformat().replace("+00:00", "Z")
                timestamps.add(timestamp)
                append_value(values, record, metric_variable, location_variable)
    sorted_timestamps = sorted(timestamps)
    return {"timestamps": sorted_timestamps, "values": values}
