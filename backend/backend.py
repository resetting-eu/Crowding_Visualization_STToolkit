from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import influxdb_client
import datetime
from dotenv import dotenv_values
from pymongo import MongoClient
from apscheduler.schedulers.background import BackgroundScheduler

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
query_range_no_aggregate = 'from(bucket: "VodafoneLxData")\
  |> range(start: _start, stop: _end)\
  |> filter(fn: (r) => r["_field"] == _measurement)'

def get_values_range(start, end, every, measurement, aggregate=True):
    with influxdb_client.InfluxDBClient(url=config["INFLUXDB_URL"], token=config["INFLUXDB_TOKEN"], org=config["INFLUXDB_ORG"], debug=debug) as client:
        query_api = client.query_api()
        # TODO usar bind parameters em vez de espetar os params diretamente na query string
        #tables = query_api.query(query_range, params={"_start": start, "_end": end, "_every": every})
        query_str = query_range if aggregate else query_range_no_aggregate
        query_str = query_str.replace("_start", start).replace("_end", end).replace("_every", every).replace("_measurement", '"' + measurement + '"')
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


## streaming

current_dt = datetime.datetime.fromisoformat("2022-05-01T00:00:00+00:00")

INITIAL_BUFFER_TIMEDELTA = datetime.timedelta(hours=24)
INCREMENT = datetime.timedelta(minutes=5)

def increment_current_dt():
  global current_dt
  current_dt = current_dt + INCREMENT

scheduler = BackgroundScheduler()
scheduler.add_job(func=increment_current_dt, trigger="interval", seconds=10)
scheduler.start()

@app.route("/mock_stream")
def mock_stream():
    last_timestamp = request.args.get("last_timestamp")
    last_timestamp = last_timestamp.replace("Z", "+00:00") # workaround because of python datetime limitation
    if last_timestamp:
        last_dt = datetime.datetime.fromisoformat(last_timestamp)
        if last_dt < current_dt:
            start = last_dt + INCREMENT
            end = current_dt + datetime.timedelta(minutes=1)
        else:
            return jsonify({"timestamps": [], "measurements": []})
    else:
        start = current_dt - INITIAL_BUFFER_TIMEDELTA
        end = current_dt + datetime.timedelta(minutes=1)    
    return jsonify(get_values_range(start.isoformat(), end.isoformat(), "5m", "C1", False))
