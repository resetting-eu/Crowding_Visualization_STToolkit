# built-in modules
import json
import math
import sys
import subprocess

# third party libraries
import utm
from pymongo import MongoClient

##

if len(sys.argv) < 6:
    print(f"Usage: python {sys.argv[0]} locations_file pbf_file mongodb_url mongodb_database route_time_limit", file=sys.stderr)
    sys.exit(1)

LOCATIONS_FILE = sys.argv[1]
PBF_FILE = sys.argv[2]
MONGODB_URL = sys.argv[3]
MONGODB_DATABASE = sys.argv[4]
TIME_LIMIT = int(sys.argv[5]) # seconds

SPEED = 1.3 # m/s

##

with open(LOCATIONS_FILE, encoding="utf-8") as f:
    points_geojson = json.load(f)

bounding_rectangle = [math.inf, -math.inf, -math.inf, math.inf] # x_left, x_right, y_top, y_bot
for feature in points_geojson:
    p = feature["geometry"]["coordinates"]
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

# add some slack to the bounding rectangle
slack = TIME_LIMIT * SPEED
bounding_rectangle_with_slack = [
    bounding_rectangle[0] - slack,
    bounding_rectangle[1] + slack,
    bounding_rectangle[2] - slack,
    bounding_rectangle[3] + slack
]
# convert back to latlon
topleft_latlon = utm.to_latlon(bounding_rectangle_with_slack[0], bounding_rectangle_with_slack[2], zone_number, zone_letter)
botright_latlon = utm.to_latlon(bounding_rectangle_with_slack[1], bounding_rectangle_with_slack[3], zone_number, zone_letter)
bounding_rectangle_final = [topleft_latlon[1], botright_latlon[0], botright_latlon[1], topleft_latlon[0]] # left, bottom, right, top

# osmium commands with bounding rectangle
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

#print the command to start GraphHopper
print("Download and put the GraphHopper jar in this directory if you haven't already:")
print("https://repo1.maven.org/maven2/com/graphhopper/graphhopper-web/8.0/graphhopper-web-8.0.jar")
print("")
print("Then, run the following command on a different shell to start up GraphHopper:")
print(f"java -D\"dw.graphhopper.datareader.file={OUTPUT_PBF_FILE}\" -jar graphhopper*.jar server helper_files/gh-config.yml")
print("And once the GraphHopper server is ready, run the next script:")
print(f"python point_locations_carrying_capacity {LOCATIONS_FILE} {PBF_FILE} {MONGODB_URL} {MONGODB_DATABASE} {TIME_LIMIT}")
