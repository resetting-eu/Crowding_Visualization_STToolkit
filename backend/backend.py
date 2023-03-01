from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import influxdb_client
import datetime
from dotenv import dotenv_values
from pymongo import MongoClient

app = Flask(__name__)
CORS(app)

config = dotenv_values(".env")

@app.route("/data_range")
def data_range():
    args = request.args
    return jsonify(get_values_range(args.get("start"), args.get("end"), args.get("every"), args.get("measurement")))

# transforma string em timedelta (para usar no "every")
def timedelta(every_int, every_unit):
    return datetime.timedelta(**{every_unit: int(every_int)})

@app.route("/grid")
def grid():
    with MongoClient(config["MONGODB_URL"]) as client:
        db = client.get_default_database()
        features = list(db[config["MONGODB_COLLECTION"]].find())
        # delete _id field since jsonify can't serialize it and it's not needed
        for f in features:
            del f["_id"]
        return jsonify(features)

debug = True

query_range = 'from(bucket: "VodafoneLxData")\
  |> range(start: _start, stop: _end)\
  |> filter(fn: (r) => r["_field"] == _measurement)\
  |> aggregateWindow(every: _every, fn: mean, createEmpty: false)'

def get_values_range(start, end, every, measurement):
    with influxdb_client.InfluxDBClient(url=config["INFLUXDB_URL"], token=config["INFLUXDB_TOKEN"], org=config["INFLUXDB_ORG"], debug=debug) as client:
        query_api = client.query_api()
        # TODO usar bind parameters em vez de espetar os params diretamente na query string
        #tables = query_api.query(query_range, params={"_start": start, "_end": end, "_every": every})
        query_str = query_range.replace("_start", start).replace("_end", end).replace("_every", every).replace("_measurement", '"' + measurement + '"')
        tables = query_api.query(query_str)
        timestamps = set()
        measurements = []
        for _ in range(3743): # TODO - replace magic number with db response length
            measurements.append([])
        for table in tables:
            for record in table.records:
                timestamp = record.row[4].isoformat().replace("+00:00", "Z")
                timestamps.add(timestamp)
                index = int(record.row[7]) - 1
                m = measurements[index]
                m.append(round(record.row[5]))
    sorted_timestamps = sorted(timestamps)
    return {"timestamps": sorted_timestamps, "measurements": measurements}
