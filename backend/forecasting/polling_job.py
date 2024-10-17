import json
from datetime import timedelta, datetime
from time import sleep
from copy import deepcopy
from threading import Thread
import sys
import influxdb_client
from influxdb_client import Point
import numpy as np
from importlib import import_module

# TODO deduplicate this function
def parse_duration(duration):
    n = int(duration[:-1])
    u = duration[-1]
    assert u in ["m", "h", "d", "w"]
    if u == "m":
        return timedelta(minutes=n)
    elif u == "h":
        return timedelta(hours=n)
    elif u == "d":
        return timedelta(days=n)
    elif u == "w":
        return timedelta(weeks=n)
    
def timestamp_to_dt(timestamp):
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    
def printerr(s):
    print(s, file=sys.stderr)

class Forecaster:

    def __init__(self, parameters, model_parameters, model_name):
        self.model_name = model_name
        self.forecast = import_module(".models." + model_name, "backend.forecasting").forecast
        
        self.model_parameters = model_parameters

        self.url = parameters["url"]
        self.token = parameters["token"]
        self.org = parameters["org"]
        self.bucket = parameters["bucket"]
        self.metric_variable = parameters["metric_variable"] # TODO use this
        self.location_variable = parameters["location_variable"]

        self.MIN_REAL_TIMESTAMPS = parameters.get("min_real_timestamps")
        self.MAX_LOCAL_TO_OVERALL_GAP = parse_duration(parameters["max_local_to_overall_gap"])
        self.INTERVAL = parse_duration(parameters["interval"])
        self.MIN_STEPS = parameters["min_steps"]
        self.OUTPUT_TOTAL_TIMESTAMPS = parameters.get("output_total_timestamps")
        self.N_SIMULATIONS = parameters["n_simulations"]

        self.last_real_data = {}
        self.saved_predicted_values = {}
        self.last_real_dt = datetime.fromisoformat("1900-01-01T00:00:00+00:00")

        self.N = 24*7 # TODO parametrize

    def query_real_data(self): # TODO parametrize range start?
        query_str = f"""
            from(bucket: "{self.bucket}")
                |> range(start: -120d)
                |> aggregateWindow(every: 1h, fn: mean, createEmpty: false)
                |> sort(columns: ["_time"], desc: true)
                |> limit(n: {self.N})
            """
        return self.get_query_values(query_str)

    def get_query_values(self, query_str):
        with influxdb_client.InfluxDBClient(url=self.url, token=self.token, org=self.org, debug=False) as client:
            query_api = client.query_api()
            tables = query_api.query(query_str)
            timestamps = set()
            values = {}
            for table in tables:
                for record in table.records:
                    timestamp = record.values["_time"].isoformat().replace("+00:00", "Z")
                    timestamps.add(timestamp)
                    location = record.values[self.location_variable]
                    value = record.values["_value"]
                    if location not in values:
                        values[location] = {}
                    values[location][timestamp] = value

        sorted_timestamps = sorted(timestamps)
        # now we select the final N timestamps for which values will be considered
        last_timestamps = sorted_timestamps[-self.N:]
        # but we still return all values as "old" timestamps will be useful for model training.
        # The gap between the last timestamp of a location and the first timestamp of last_timestamps
        # will be filled with predictions.

        return values, last_timestamps
    
    def check_discard_location(self, values, location, timestamps, last_timestamps):
        if len(values[location]) < self.MIN_REAL_TIMESTAMPS:
            printerr(f"skipped training location {location}: not enough data")
            return True

        last_location_dt = timestamp_to_dt(timestamps[-1])
        last_overall_dt = timestamp_to_dt(last_timestamps[-1])
        if last_overall_dt - last_location_dt > self.MAX_LOCAL_TO_OVERALL_GAP:
            printerr(f"skipped training location {location}: "
                + "too big of a gap between location available time range and overall time range")
            return True
        
        # TODO fill missing values when necessary instead of skipping location
        last_dt = timestamp_to_dt(timestamps[0])
        for timestamp in timestamps[1:]:
            dt = timestamp_to_dt(timestamp)
            if dt - last_dt > self.INTERVAL:
                printerr(f"missing timestamp in location {location}! (skipped) last: {last_dt.isoformat()}; current: {dt.isoformat()}")
                return True
            last_dt = dt

        return False

    def forecast_location(self, location, values, last_timestamps, steps, model_parameters):
        printerr(f"forecasting location {location}")

        # sorted timestamps in real data, which can span an earlier time range than last_timestamps
        timestamps = sorted([timestamp for timestamp in values[location].keys()])

        if(self.check_discard_location(values, location, timestamps, last_timestamps)):
            return

        # values sorted by timestamp
        xs = [values[location][timestamp] for timestamp in timestamps]

        total_steps_to_forecast = self.calc_steps_to_forecast(timestamps, last_timestamps, steps)

        res = self.forecast(xs, total_steps_to_forecast, self.N_SIMULATIONS, model_parameters)
        return res

    def check_dirty_locations(self, values):
        dirty_locations = []
        for location in values:
            if values[location] != self.last_real_data.get(location):
                dirty_locations.append(location)
        return dirty_locations

    def get_last_dt(self, values):
        max_dt = datetime.fromisoformat("1900-01-01T00:00:00+00:00")
        for location in values:
            location_last_timestamp = sorted(values[location].keys())[-1]
            location_last_dt = timestamp_to_dt(location_last_timestamp)
            if location_last_dt > max_dt:
                max_dt = location_last_dt
        return max_dt

    # pre: location_timestamps and last_overall_timestamps are sorted
    def calc_steps_to_forecast(self, location_timestamps, last_overall_timestamps, min_steps):
        last_location_timestamp = location_timestamps[-1]
        if last_location_timestamp in last_overall_timestamps:
            i = last_overall_timestamps.index(last_location_timestamp)
            return len(last_overall_timestamps) - (i+1) + min_steps
        else:
            last_location_dt = timestamp_to_dt(last_location_timestamp)
            first_overall_dt = timestamp_to_dt(last_overall_timestamps[0])
            gap_duration = first_overall_dt - last_location_dt
            return int(gap_duration / self.INTERVAL) + min_steps

    def calc_result_timestamps(self, last_timestamps):
        n_real = self.OUTPUT_TOTAL_TIMESTAMPS - self.MIN_STEPS
        res = deepcopy(last_timestamps[-n_real:])
        last_dt = timestamp_to_dt(last_timestamps[-1])
        for i in range(self.MIN_STEPS):
            timestamp = (last_dt + self.INTERVAL*(i+1)).isoformat()
            res.append(timestamp)
        return res

    def train_and_forecast(self, real_values, last_timestamps, model_parameters):
        values = {}
        for location in real_values:
            location_res = self.forecast_location(location, real_values, last_timestamps, self.MIN_STEPS, model_parameters)
            if location_res:
                values[location] = location_res
        return values

    def prepare_values(self, real_values, real_timestamps):
        res = {"values": {"total_of_directions": {}}, "timestamps": []}
        for location in real_values:
            if location not in self.saved_predicted_values:
                continue
            # TODO the metric name should be parametrized
            res["values"]["total_of_directions"][location] = [real_values[location][timestamp] for timestamp in sorted(real_values[location])]
            res["values"]["total_of_directions"][location] += self.saved_predicted_values[location]
        last_dt = timestamp_to_dt(real_timestamps[-1])
        res["timestamps"] = deepcopy(real_timestamps)
        for i in range(1, self.MIN_STEPS + 1):
            res["timestamps"].append((last_dt + self.INTERVAL * i).isoformat().replace("+00:00", "Z"))
        res["timestamps"] = res["timestamps"][-self.OUTPUT_TOTAL_TIMESTAMPS:]
        for location in res["values"]["total_of_directions"]:
            res["values"]["total_of_directions"][location] = res["values"]["total_of_directions"][location][-self.OUTPUT_TOTAL_TIMESTAMPS:]
        return res

    def save_predicted_values(self, predicted_values):
        for location in predicted_values:
            self.saved_predicted_values[location] = predicted_values[location]

    def save_real_values(self, real_values):
        self.last_real_data = real_values

    def poll_and_push(self, new_data_handler):
        printerr("Querying real values")
        values, last_timestamps = self.query_real_data()
        dirty_locations = self.check_dirty_locations(values)
        if not dirty_locations:
            printerr("No dirty locations")
            return
        new_last_dt = self.get_last_dt(values)
        if new_last_dt > self.last_real_dt:
            # need to retrain all locations        
            self.last_real_dt = new_last_dt
            values_for_training = values
            printerr("training all locations")
        else:
            # can retrain only "dirty" locations
            dirty_location_values = {}
            for location in dirty_locations:
                dirty_location_values[location] = values[location]
            values_for_training = dirty_location_values
            printerr(f"training {len(values)} locations")
        new_values = self.train_and_forecast(values_for_training, last_timestamps, self.model_parameters)
        self.save_real_values(values)
        self.save_predicted_values(new_values)
        res = self.prepare_values(values, last_timestamps)
        new_data_handler(res)
        printerr("Iteration complete")

    def test_location(self, location, values, last_timestamps, model_parameters):
        printerr(f"testing location {location}")

        # sorted timestamps in real data, which can span an earlier time range than last_timestamps
        timestamps = sorted([timestamp for timestamp in values[location].keys()])

        if(self.check_discard_location(values, location, timestamps, last_timestamps)):
            return

        # values sorted by timestamp
        xs = [values[location][timestamp] for timestamp in timestamps]

        train_size = round(len(xs) * 0.8)
        test_size = len(xs) - train_size
        xs_train = xs[:train_size]
        xs_test = xs[train_size:]

        forecast_res = self.forecast(xs, len(xs), self.N_SIMULATIONS, model_parameters)

        mae, sum_y, mse = [], [], []
        for i in range(test_size):
            real = xs_test[i]
            predicted = forecast_res[i][2] # q2
            d = np.abs(real - predicted)
            mae.append(d)
            sum_y.append(real)
            mse.append(d ** 2)

        return mae, sum_y, mse, len(xs_train)

    def train_and_test(self, values, last_timestamps, model_parameters):
        mae, sum_y, mse, len_train = [], [], [], []
        for location in values:
            location_res = self.test_location(location, values, last_timestamps, model_parameters)
            if location_res:
                loc_mae, loc_sum_y, loc_mse, loc_len_train = location_res
                mae += loc_mae
                sum_y += loc_sum_y
                mse += loc_mse
                len_train.append(loc_len_train)

        MAE = np.array(mae).mean()
        RMSE = np.sqrt(np.array(mse).mean())
        WMAPE = np.sum(np.array(mae)) / np.sum(np.array(sum_y))
        AVG_TRAIN_SIZE = np.array(len_train).mean()
        return {"MAE": MAE, "RMSE": RMSE, "WMAPE": WMAPE, "N_LOCATIONS_TESTED": len(len_train), "AVG_TRAIN_SIZE": AVG_TRAIN_SIZE}

    def evaluate(self):
        printerr("Evaluating model: " + self.model_name)
        printerr("Querying real values")
        values, last_timestamps = self.query_real_data()
        metrics = self.train_and_test(values, last_timestamps, self.model_parameters)
        printerr("Evaluation complete")
        return metrics


SLEEP_SECONDS = 60*5 # TODO parametrize?

def run_job(new_data_handler, forecaster):
    while True:
        forecaster.poll_and_push(new_data_handler)
        printerr("Sleeping")
        sleep(SLEEP_SECONDS)

def run_job_on_new_thread(new_data_handler, parameters, model_parameters, model_name):
    forecaster = Forecaster(parameters, model_parameters, model_name)
    _, last_timestamps = forecaster.query_real_data()
    t = Thread(target=run_job, args=[new_data_handler, forecaster])
    t.start()
    return last_timestamps[-1]

def evaluate_models(parameters):
    model_parameters = parameters["model_parameters"]
    model_names = parameters["model_names"]
    metrics_per_model = {}
    for model_name in model_names:
        forecaster = Forecaster(parameters, model_parameters, model_name)
        metrics_per_model[model_name] = forecaster.evaluate()
    printerr(metrics_per_model)
    return metrics_per_model

if __name__ == "__main__":
    prediction_result_counter = 0
    def save_result(values):
        global prediction_result_counter
        with open(f"prediction_result_{prediction_result_counter}.json", "w") as f:
            json.dump(values, f)
        prediction_result_counter += 1
    run_job(save_result, {"seasonality": 24, "hidden_size": 24, "learning_rate": 0.02, "training_epochs": 100})
