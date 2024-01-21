# built-in modules
import json
import sys
import subprocess

# third party libraries
import requests
from pymongo import MongoClient

##

if len(sys.argv) < 6:
    print(f"Usage: python {sys.argv[0]} locations_file pbf_file mongodb_url mongodb_database route_time_limit", file=sys.stderr)
    sys.exit(1)

LOCATIONS_FILE = sys.argv[1]
PBF_FILE = sys.argv[2]
MONGODB_URL = sys.argv[3]
MONGODB_DATABASE = sys.argv[4]
TIME_LIMIT = int(sys.argv[5])

SPEED = 1.3 # m/s

##

with open(LOCATIONS_FILE, encoding="utf-8") as f:
    points_geojson = json.load(f)

session = requests.Session()
areas_geojson = []
for feature in points_geojson:
    # get isochrone for point
    p = feature["geometry"]["coordinates"]
    res = session.get(f"http://localhost:8989/isochrone?point={p[1]},{p[0]}&profile=foot&time_limit={TIME_LIMIT}")
    new_feature = res.json()["polygons"][0]
    new_feature["properties"] = feature["properties"]
    new_feature["properties"]["latitude"] = p[1]
    new_feature["properties"]["longitude"] = p[0]
    areas_geojson.append(new_feature)

# put isochrones in mongo
with MongoClient(MONGODB_URL) as client:
    database = client[MONGODB_DATABASE]
    collection = database["crowding_polygons"]
    result = collection.insert_many(areas_geojson)

# run carrying capacity script
subprocess.run(f"python carrying_capacity.py {MONGODB_URL} {MONGODB_DATABASE}")

# convert back to point locations
with open("crowding_polygons_with_usable_areas.json") as f:
    features = json.load(f)

for feat in features:
    feat["geometry"] = {
        "type": "Point",
        "coordinates": [
            feat["properties"]["longitude"],
            feat["properties"]["latitude"]
        ]
    }

OUTPUT_FILE = "point_locations_with_usable_areas.json"
with open(OUTPUT_FILE, "w") as f:
    json.dump(features, f)

print(f"Result: {OUTPUT_FILE}")
