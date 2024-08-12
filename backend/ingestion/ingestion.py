import json
from datetime import datetime
from os import environ
from importlib import import_module
from time import sleep
import yaml
from yaml.loader import SafeLoader
from influxdb_client import InfluxDBClient

config_file = environ["CONFIG"] if "CONFIG" in environ else "ingestion_config.yml"
with open(config_file, encoding="utf-8") as f:
    cfg = yaml.load(f.read(), Loader=SafeLoader)

POLLING_INTERVAL = cfg["polling_interval"]
MODE = cfg["mode"]
assert MODE in ("live", "historical")

URL = cfg["influxdb_parameters"]["url"]
TOKEN = cfg["influxdb_parameters"]["token"]
ORG = cfg["influxdb_parameters"]["org"]
BUCKET = cfg["influxdb_parameters"]["bucket"]

client = InfluxDBClient(url=URL, token=TOKEN, org=ORG)

def write_points(points):
    with client.write_api() as write_api:
        write_api.write(record=points, bucket=BUCKET)

connector_module = import_module(cfg["connector"])
if MODE == "live":
    ingest_records = connector_module.init(cfg["connector_parameters"], write_points)
else: # MODE == "historical"
    ingest_records = connector_module.load_historical(cfg["connector_parameters"], write_points)

STORAGE_FILENAME = "ingestion_storage.json"

try:
    with open(STORAGE_FILENAME) as f:
        storage = json.load(f)
except FileNotFoundError:
    storage = {}

def get_last_timestamp():
    return storage["last_timestamp"]

def set_last_timestamp(timestamp):
    storage["last_timestamp"] = timestamp

if "last_timestamp" not in storage:
    set_last_timestamp(cfg["fetch_from"])

def update_storage():
    with open(STORAGE_FILENAME, "w") as f:
        json.dump(storage, f)

def set_last_dt_and_update_storage(dt):
    if dt:
        last_timestamp = datetime.isoformat(dt)
        set_last_timestamp(last_timestamp)
        update_storage()


def fetch_and_push_live():
    last_timestamp = get_last_timestamp()
    print(f"Fetching from {last_timestamp}")
    max_dt = ingest_records(last_timestamp)
    set_last_dt_and_update_storage(max_dt)

def fetch_and_push_historical():
    fetch_from = get_last_timestamp()
    fetch_to = cfg["fetch_to"]
    print(f"Fetching from {fetch_from} to {fetch_to}")
    max_dt = ingest_records(fetch_from, fetch_to)
    set_last_dt_and_update_storage(max_dt)        

if MODE == "live":
    while True:
        fetch_and_push_live()
        sleep(POLLING_INTERVAL)
else:
    fetch_and_push_historical()
    client.close()
