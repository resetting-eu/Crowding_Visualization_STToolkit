# built-in modules
import json
import sys
import subprocess

# third party libraries
import requests
from pymongo import MongoClient
from turfpy.measurement import area

##

if len(sys.argv) < 5:
    print(f"Usage: python {sys.argv[0]} locations_file mongodb_url mongodb_database route_time_limit", file=sys.stderr)
    sys.exit(1)

LOCATIONS_FILE = sys.argv[1]
MONGODB_URL = sys.argv[2]
MONGODB_DATABASE = sys.argv[3]
TIME_LIMIT = int(sys.argv[4])

SPEED = 1.3 # m/s

##

with open(LOCATIONS_FILE, encoding="utf-8") as f:
    points_geojson = json.load(f)
    if isinstance(points_geojson, dict):
        points_geojson = points_geojson["features"]

session = requests.Session()
areas_geojson = []
for feature in points_geojson:
    # get isochrone for point
    p = feature["geometry"]["coordinates"]
    res = session.get(f"http://localhost:8989/isochrone?point={p[1]},{p[0]}&profile=foot&time_limit={TIME_LIMIT}")
    new_feature = res.json()["polygons"][0]
    new_feature["properties"] = feature["properties"]
    areas_geojson.append(new_feature)

# put isochrones in mongo
with MongoClient(MONGODB_URL) as client:
    database = client[MONGODB_DATABASE]
    collection = database["crowding_polygons"]
    collection.delete_many({})
    result = collection.insert_many(areas_geojson)

# "_id" object property is inserted by mongo, so we need to remove it
for isochrone in areas_geojson:
    del isochrone["_id"]

# run carrying capacity script
subprocess.run(f"python carrying_capacity.py {MONGODB_URL} {MONGODB_DATABASE}")

# convert back to point locations
with open("walkable_areas.json") as f:
    walkable_areas = json.load(f)

for point_feature in points_geojson:
    id = point_feature["properties"]["id"]
    walkable_area = next(x for x in walkable_areas if x["properties"]["id"] == id)
    point_feature["properties"]["usable_area"] = area(walkable_area)

OUTPUT_FILE = "point_locations_with_usable_areas.json"
with open(OUTPUT_FILE, "w") as f:
    json.dump(points_geojson, f)

# output isochrones
with open("isochrones.json", "w") as f:
    json.dump(areas_geojson, f)

print(f"Results: {OUTPUT_FILE}, walkable_areas.json, isochrones.json")
