import influxdb_client
from time import perf_counter
from .utils import array_put_at, array_pad
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

def query_last_str(bucket, start, locations, location_variable, filters):
    # TODO usar bind parameters em vez de espetar os params diretamente na query string
    res = 'from(bucket: "' + bucket + '")\
        |> range(start: ' + start + ')'
    if filters:
        for filter in filters:
            res += '|> filter(fn: ' + filter + ')'
    if locations:
        locations_regex = '|'.join(map(lambda l: "^" + str(l) + "$", locations))
        res += '|> filter(fn: (r) => r["' + location_variable + '"] =~ /' + locations_regex + '/)'
    res += '|> keep(columns: ["_time"]) |> sort(columns: ["_time"]) |> last(column: "_time")'
    return res

def put_value(values, record, metric_variable, location_variable, index):
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
        array_put_at(metric_obj[location_id], index, value)
    else:
        if location_id not in values:
            values[location_id] = []
        array_put_at(values[location_id], index, value)

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
                index = sorted(timestamps).index(timestamp)
                put_value(values, record, metric_variable, location_variable, index)
    pad_values(values, len(timestamps))
    return {"timestamps": sorted(timestamps), "values": values}

def query_last_timestamp(url, token, org, bucket, start, location_variable, locations=[], filters=[]):
    with influxdb_client.InfluxDBClient(url=url, token=token, org=org, debug=False) as client:
        query_api = client.query_api()
        query_str = query_last_str(bucket, start, locations, location_variable, filters)
        start_time = perf_counter()
        tables = query_api.query(query_str)
        end_time = perf_counter()
        print("query time: {}".format(end_time - start_time), file=sys.stderr)
        for table in tables:
            for record in table.records:
                return record.values["_time"].isoformat().replace("+00:00", "Z")
    raise Exception("No data in range")

def pad_values(values, length):
    for metric_name in values:
        for location in values[metric_name]:
            array_pad(values[metric_name][location], length)
