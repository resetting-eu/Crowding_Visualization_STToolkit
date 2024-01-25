#built-in modules
import json
import math
import sys
import subprocess

#third-party modules
import utm
from pymongo import MongoClient

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

bounding_rectangle = [math.inf, -math.inf, -math.inf, math.inf] # x_left, x_right, y_top, y_bot
for feature in locations:
    for l in feature["geometry"]["coordinates"]:
        for p in l:
            p_utm = utm.from_latlon(p[1], p[0])
            x, y, zone_number, zone_letter = p_utm
            if x < bounding_rectangle[0]:
                bounding_rectangle[0] = x
            elif x > bounding_rectangle[1]:
                bounding_rectangle[1] = x
            if y > bounding_rectangle[2]:
                bounding_rectangle[2] = y
            elif y < bounding_rectangle[3]:
                bounding_rectangle[3] = y

# convert back to latlon
topleft_latlon = utm.to_latlon(bounding_rectangle[0], bounding_rectangle[2], zone_number, zone_letter)
botright_latlon = utm.to_latlon(bounding_rectangle[1], bounding_rectangle[3], zone_number, zone_letter)
bounding_rectangle_final = [topleft_latlon[1], botright_latlon[0], botright_latlon[1], topleft_latlon[0]] # left, bottom, right, top


PBF_FILE_BASENAME = PBF_FILE[:PBF_FILE.find(".")]
OUTPUT_GEOJSON_FILE = PBF_FILE_BASENAME + "_with_bounding_box.geojson"
OUTPUT_PBF_FILE = PBF_FILE_BASENAME + "_with_bounding_box.osm.pbf"

command_str_pbf = f"osmium extract -b {','.join(map(str, bounding_rectangle_final))} {PBF_FILE} -o {OUTPUT_PBF_FILE}"
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
    result = collection.insert_many(features)
    collection = database["crowding_polygons"]
    result = collection.insert_many(locations)

# Determine walkable areas
subprocess.run(f"python carrying_capacity.py {MONGODB_URL} {MONGODB_DATABASE}")

print("Result in: crowding_polygons_with_usable_areas.json")
