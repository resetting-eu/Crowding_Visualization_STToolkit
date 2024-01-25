# built-in modules
import sys
import json

# third party libraries
from turfpy.transformation import intersect

##

if len(sys.argv) < 4:
    print(f"Usage: python {sys.argv[0]} locations_file parishes_file parish_name_property output_file", file=sys.stderr)
    sys.exit(1)

LOCATIONS_FILE = sys.argv[1]
PARISHES_FILE = sys.argv[2]
PARISH_NAME_PROPERTY = sys.argv[3]
OUTPUT_FILE = sys.argv[4]

##

with open(LOCATIONS_FILE, encoding="utf-8") as f:
    locations = json.load(f)
    if isinstance(locations, dict):
        locations = locations["features"]

with open(PARISHES_FILE, encoding="utf-8") as f:
    parishes = json.load(f)["features"]

res = {}

for parish in parishes:
    name = parish["properties"][PARISH_NAME_PROPERTY]
    s = set()
    for location in locations:
        i = intersect([parish, location])
        if i is not None:
            s.add(location["properties"]["id"])
    res[name] = list(s)

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(res, f)
