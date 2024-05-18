#built-in modules
import json
import sys
import subprocess

#third-party modules
from pymongo import MongoClient
from turfpy.measurement import bbox, area
from geojson import FeatureCollection

##

if len(sys.argv) < 5:
    print(f"Usage: python {sys.argv[0]} locations_file pbf_file mongodb_url mongodb_database", file=sys.stderr)
    sys.exit(1)

LOCATIONS_FILE = sys.argv[1]
PBF_FILE = sys.argv[2]
MONGODB_URL = sys.argv[3]
MONGODB_DATABASE = sys.argv[4]

##

with open(LOCATIONS_FILE, encoding="utf-8") as f:
    locations = json.load(f)
    if isinstance(locations, dict):
        locations = locations["features"]

locations_feature_collection = FeatureCollection(locations)
locations_bbox = bbox(locations_feature_collection)

PBF_FILE_BASENAME = PBF_FILE[:PBF_FILE.find(".")]
OUTPUT_GEOJSON_FILE = PBF_FILE_BASENAME + "_with_bounding_box.geojson"
OUTPUT_PBF_FILE = PBF_FILE_BASENAME + "_with_bounding_box.osm.pbf"

command_str_pbf = f"osmium extract -b {','.join(map(str, locations_bbox))} {PBF_FILE} -o {OUTPUT_PBF_FILE}"
command_str_geojson = f"osmium export {OUTPUT_PBF_FILE} -o {OUTPUT_GEOJSON_FILE}"

# run osmium to get smaller PBF file
subprocess.run(command_str_pbf)

# run osmium to get OSM GeoJSON and put the result in MongoDB
subprocess.run(command_str_geojson)
with open(OUTPUT_GEOJSON_FILE, encoding="utf-8") as f:
    features = json.load(f)["features"]
with MongoClient(MONGODB_URL) as client:
    database = client[MONGODB_DATABASE]
    collection = database["osm"]
    collection.delete_many({})
    collection.insert_many(features)
    collection = database["crowding_polygons"]
    collection.delete_many({})
    collection.insert_many(locations)

# "_id" object property is inserted by mongo, so we need to remove it
for location in locations:
    del location["_id"]

# Determine walkable areas
subprocess.run(f"python carrying_capacity.py {MONGODB_URL} {MONGODB_DATABASE}")

# Put walkable areas numeric value in crowding polygons' properties
with open("walkable_areas.json", encoding="utf-8") as f:
    walkable_areas = json.load(f)

for crowding_polygon in locations:
    id = crowding_polygon["properties"]["id"]
    walkable_area = next(x for x in walkable_areas if x["properties"]["id"] == id)
    crowding_polygon["properties"]["usable_area"] = area(walkable_area)

with open("crowding_polygons_with_usable_areas.json", "w") as f:
    json.dump(locations, f)

# Print resulting filenames
print("Results in: crowding_polygons_with_usable_areas.json, walkable_areas.json")
