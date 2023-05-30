from flask import jsonify
from pymongo import MongoClient

def generate_handler(parameters):
    url = parameters["url"]
    collection = parameters["collection"]
    unusable_area_property = parameters.get("unusable_area_property")
    def mongodb_locations_handler():
        with MongoClient(url) as client:
            db = client.get_default_database()
            features = list(db[collection].find())
            for f in features:
                if "_id" in f:
                    del f["_id"] # delete _id field since jsonify can't serialize it and it's not needed
                if unusable_area_property is not None and unusable_area_property != "unusable_area":
                    f["properties"]["unusable_area"] = f["properties"][unusable_area_property]
            return jsonify(features)
    return mongodb_locations_handler
