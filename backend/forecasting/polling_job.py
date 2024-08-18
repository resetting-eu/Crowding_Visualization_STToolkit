import json
from datetime import timedelta, datetime
from time import sleep
from copy import deepcopy
from threading import Thread
import sys
import influxdb_client
from influxdb_client import Point
from statsmodels.tsa.statespace.sarimax import SARIMAX
import numpy as np

# TODO read from config file
url= "http://localhost:8086"
token= "4_n9dEXlExEUds262HjnxImGkkEF9SjA0jC8qBKdbb0W3tg5Eic4tutm9n3FEzwiwBV276j5gUk7EYAAKvydFw=="
org= "iscte"
bucket= "melbourne_hourly"
bucket_forecasted = "melbourne_forecasted"

# TODO read from config file
MIN_REAL_TIMESTAMPS = 48
MAX_LOCAL_TO_OVERALL_GAP = timedelta(1)
INTERVAL = timedelta(hours=1)
MIN_STEPS = 48
OUTPUT_TOTAL_TIMESTAMPS = 96
N_SIMULATIONS = 1000 # simulations per forecast

assert OUTPUT_TOTAL_TIMESTAMPS > MIN_STEPS

last_real_data = {}
saved_predicted_values = {}
last_real_dt = datetime.fromisoformat("1900-01-01T00:00:00+00:00")

N = 24*7 # TODO parametrize

def printerr(s):
    print(s, file=sys.stderr)

def query_real_data():
    query_str = f"""
        from(bucket: "melbourne_hourly")
            |> range(start: -30d)
            |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
            |> sort(columns: ["_time"], desc: true)
            |> limit(n: {N})
        """
    return get_query_values(query_str)

def get_query_values(query_str):
    with influxdb_client.InfluxDBClient(url=url, token=token, org=org, debug=False) as client:
        query_api = client.query_api()
        tables = query_api.query(query_str)
        timestamps = set()
        values = {}
        for table in tables:
            for record in table.records:
                timestamp = record.values["_time"].isoformat().replace("+00:00", "Z")
                timestamps.add(timestamp)
                location = record.values["_measurement"]
                value = record.values["_value"]
                if location not in values:
                    values[location] = {}
                values[location][timestamp] = value

    sorted_timestamps = sorted(timestamps)
    # now we select the final N timestamps for which values will be considered
    last_timestamps = sorted_timestamps[-N:]
    # but we still return all values as "old" timestamps will be useful for model training.
    # The gap between the last timestamp of a location and the first timestamp of last_timestamps
    # will be filled with predictions.

    return values, last_timestamps

def check_dirty_locations(values):
    dirty_locations = []
    for location in values:
        if values[location] != last_real_data.get(location):
            dirty_locations.append(location)
    return dirty_locations

def get_last_dt(values):
    max_dt = datetime.fromisoformat("1900-01-01T00:00:00+00:00")
    for location in values:
        location_last_timestamp = sorted(values[location].keys())[-1]
        location_last_dt = timestamp_to_dt(location_last_timestamp)
        if location_last_dt > max_dt:
            max_dt = location_last_dt
    return max_dt

def forecast_location(location, values, last_timestamps, steps):
    printerr(f"forecasting location {location}")

    if len(values[location]) < MIN_REAL_TIMESTAMPS:
        printerr(f"skipped training location {location}: not enough data")
        return

    # sorted timestamps in real data, which can span an earlier time range than last_timestamps
    timestamps = sorted([timestamp for timestamp in values[location].keys()])

    last_location_dt = timestamp_to_dt(timestamps[-1])
    last_overall_dt = timestamp_to_dt(last_timestamps[-1])
    if last_overall_dt - last_location_dt > MAX_LOCAL_TO_OVERALL_GAP:
        printerr(f"skipped training location {location}: "
              + "too big of a gap between location available time range and overall time range")
        return
    
    # TODO fill missing values when necessary instead of skipping location
    last_dt = timestamp_to_dt(timestamps[0])
    for timestamp in timestamps[1:]:
        dt = timestamp_to_dt(timestamp)
        if dt - last_dt > INTERVAL:
            printerr(f"missing timestamp in location {location}! (skipped) last: {last_dt.isoformat()}; current: {dt.isoformat()}")
            return
        last_dt = dt

    # values sorted by timestamp
    xs = [values[location][timestamp] for timestamp in timestamps]

    total_steps_to_forecast = calc_steps_to_forecast(timestamps, last_timestamps, steps)

    model = SARIMAX(xs,
                    order=(1, 1, 1),
                    seasonal_order=(1, 1, 1, 24), # IMPORTANT: last parameter is seasonality
                    enforce_stationarity=False,
                    enforce_invertibility=False)

    model_fit = model.fit(disp=False)

    # Generate simulated forecasts
    simulated_forecasts = np.zeros((N_SIMULATIONS, total_steps_to_forecast))

    for i in range(N_SIMULATIONS):
        simulated_forecasts[i, :] = model_fit.simulate(total_steps_to_forecast, anchor='end', repetitions=1).reshape(-1)

    # Calculate quartiles for each forecasted step
    quartiles = np.percentile(simulated_forecasts, [0, 25, 50, 75, 100], axis=0)
    q0 = quartiles[0, :]
    q1 = quartiles[1, :]
    q2 = quartiles[2, :]
    q3 = quartiles[3, :]
    q4 = quartiles[4, :]

    res = []
    for i in range(total_steps_to_forecast):
        l = [q0[i], q1[i], q2[i], q3[i], q4[i]]
        for j in range(len(l)):
            if l[j] < 0:
                l[j] = 0.0
        res.append(l)
    
    # res now has {total_steps_to_forecast} predictions
    return res


# pre: location_timestamps and last_overall_timestamps are sorted
def calc_steps_to_forecast(location_timestamps, last_overall_timestamps, min_steps):
    last_location_timestamp = location_timestamps[-1]
    if last_location_timestamp in last_overall_timestamps:
        i = last_overall_timestamps.index(last_location_timestamp)
        return len(last_overall_timestamps) - (i+1) + min_steps
    else:
        last_location_dt = timestamp_to_dt(last_location_timestamp)
        first_overall_dt = timestamp_to_dt(last_overall_timestamps[0])
        gap_duration = first_overall_dt - last_location_dt
        return int(gap_duration / INTERVAL) + min_steps

def timestamp_to_dt(timestamp):
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

def calc_result_timestamps(last_timestamps):
    n_real = OUTPUT_TOTAL_TIMESTAMPS - MIN_STEPS
    res = deepcopy(last_timestamps[-n_real:])
    last_dt = timestamp_to_dt(last_timestamps[-1])
    for i in range(MIN_STEPS):
        timestamp = (last_dt + INTERVAL*(i+1)).isoformat()
        res.append(timestamp)
    return res

def train_and_forecast(real_values, last_timestamps):
    values = {}
    for location in real_values:
        location_res = forecast_location(location, real_values, last_timestamps, MIN_STEPS)
        if location_res:
            values[location] = location_res
    return values

def prepare_values(real_values, real_timestamps):
    res = {"values": {"total_of_directions": {}}, "timestamps": []}
    for location in real_values:
        if location not in saved_predicted_values:
            continue
        # TODO the metric name should be parametrized
        res["values"]["total_of_directions"][location] = [real_values[location][timestamp] for timestamp in sorted(real_values[location])]
        res["values"]["total_of_directions"][location] += saved_predicted_values[location]
    last_dt = timestamp_to_dt(real_timestamps[-1])
    res["timestamps"] = deepcopy(real_timestamps)
    for i in range(1, MIN_STEPS + 1):
        res["timestamps"].append((last_dt + INTERVAL * i).isoformat().replace("+00:00", "Z"))
    res["timestamps"] = res["timestamps"][-OUTPUT_TOTAL_TIMESTAMPS:]
    for location in res["values"]["total_of_directions"]:
        res["values"]["total_of_directions"][location] = res["values"]["total_of_directions"][location][-OUTPUT_TOTAL_TIMESTAMPS:]
    return res

def save_predicted_values(predicted_values):
    for location in predicted_values:
        saved_predicted_values[location] = predicted_values[location]

def save_real_values(real_values):
    global last_real_data
    last_real_data = real_values

def poll_and_push(new_data_handler):
    printerr("Querying real values")
    values, last_timestamps = query_real_data()
    dirty_locations = check_dirty_locations(values)
    if not dirty_locations:
        printerr("No dirty locations")
        return
    new_last_dt = get_last_dt(values)
    global last_real_dt
    if new_last_dt > last_real_dt:
        # need to retrain all locations        
        last_real_dt = new_last_dt
        values_for_training = values
        printerr("training all locations")
    else:
        # can retrain only "dirty" locations
        dirty_location_values = {}
        for location in dirty_locations:
            dirty_location_values[location] = values[location]
        values_for_training = dirty_location_values
        printerr(f"training {len(values)} locations")
    new_values = train_and_forecast(values_for_training, last_timestamps)
    save_real_values(values)
    save_predicted_values(new_values)
    res = prepare_values(values, last_timestamps)
    new_data_handler(res)
    printerr("Iteration complete")

SLEEP_SECONDS = 60*5 # TODO parametrize?

def run_job(new_data_handler):
    while True:
        poll_and_push(new_data_handler)
        printerr("Sleeping")
        sleep(SLEEP_SECONDS)

def run_job_on_new_thread(new_data_handler):
    _, last_timestamps = query_real_data()
    t = Thread(target=run_job, args=[new_data_handler])
    t.start()
    return last_timestamps[-1]

if __name__ == "__main__":
    prediction_result_counter = 0
    def save_result(values):
        global prediction_result_counter
        with open(f"prediction_result_{prediction_result_counter}.json", "w") as f:
            json.dump(values, f)
        prediction_result_counter += 1
    run_job(save_result)
