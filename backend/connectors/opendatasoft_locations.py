from urllib.request import urlopen
import json

def generate_handler(parameters):
    url_prefix = parameters["url"]
    dataset = parameters["dataset"]
    location_property = parameters["location_property"]
    url = "{}/catalog/datasets/{}/exports/geojson".format(url_prefix, dataset)
    def opendatasoft_locations_handler(_):
        res = json.loads(urlopen(url).read())
        if isinstance(res, dict): # feature collection
            features = res["features"]
        else:
            features = res
        for feature in features:
            feature["properties"]["id"] = feature["properties"][location_property]
        return features
    return opendatasoft_locations_handler
