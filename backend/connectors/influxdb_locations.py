from .common.influxdb import query_range_str
from .common.utils import dt_to_string
import influxdb_client

def generate_handler(parameters):
    url = parameters["url"]
    token = parameters["token"]
    org = parameters["org"]
    bucket = parameters["bucket"]
    location_variable = parameters["location_variable"]
    filters = parameters.get("filters")
    start = dt_to_string(parameters["start"])
    latlong_variable = parameters["latlong_variable"]
    def influxdb_locations_handler(_):
        res = query_locations(url, token, org, bucket, start, location_variable, latlong_variable, filters)
        return res
    return influxdb_locations_handler

def query_locations(url, token, org, bucket, start, location_variable, latlong_variable, filters=[]):
    with influxdb_client.InfluxDBClient(url=url, token=token, org=org, debug=False) as client:
        query_api = client.query_api()
        query_str = query_range_str(bucket, start, None, None, None, location_variable, filters)
        tables = query_api.query(query_str)
        locations = []
        for table in tables:
            for record in table.records:
                location_id = record.values[location_variable]
                coordinate_index = 1 if record.values[latlong_variable] == "latitude" else 0
                feature = get_feature_by_id(locations, location_id)
                if not feature:
                    feature = new_feature(location_id)
                    locations.append(feature)
                feature["geometry"]["coordinates"][coordinate_index] = record.values["_value"]
    return locations

def get_feature_by_id(features, id):
    for feature in features:
        if feature["properties"]["id"] == id:
            return feature

def new_feature(id):
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [0,0]}, "properties": {"id": id}}
