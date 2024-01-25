# built-in modules
import sys

# third party libraries
import yaml
from yaml.loader import SafeLoader
import influxdb_client

###

# TODO handle derived metrics

if len(sys.argv) < 4:
    print(f"Usage: python {sys.argv[0]} config_file start_date end_date <quantile>", file=sys.stderr)
    sys.exit(1)

config_file = sys.argv[1]
start_date = sys.argv[2]
end_date = sys.argv[3]
quantile = sys.argv[4] if len(sys.argv) > 4 else 0.9

# print(f"Reading from {config_file}; quantile={quantile}")

with open(config_file, encoding="utf-8") as f:
    cfg = yaml.load(f.read(), Loader=SafeLoader)

assert cfg["history"]["connector"] == "influxdb_history"

params = cfg["history"]["parameters"]

url = params["url"]
token = params["token"]
org = params["org"]
bucket = params["bucket"]
metric_variable = params["metric_variable"]

metrics = map(lambda m: m["name"], cfg["metadata"]["metrics"])

with influxdb_client.InfluxDBClient(url=url, token=token, org=org, debug=False, timeout=60000) as client:
    query_api = client.query_api()
    for metric in metrics:
        query_str = "from(bucket: \"" + bucket + "\")\
                    |> range(start: " + start_date + ", stop: " + end_date + ")\
                    |> filter(fn: (r) => r[\"" + metric_variable + "\"] == \"" + metric + "\")\
                    |> quantile(q: " + str(quantile) + ")\
                    |> map(fn: (r) => ({_value: r._value}))\
                    |> max()"

        tables = query_api.query(query_str)

        try:
            table = tables[0]
            for record in table:
                value = record.values["_value"]
            print(f"{metric} {value}")
        except Exception:
            print(f"{metric} skipped")
