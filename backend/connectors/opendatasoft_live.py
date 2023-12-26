from .common.opendatasoft import query
from .common.utils import parse_duration, dt_to_string, array_put_at, uuid, array_pad
from datetime import datetime

clients_info = {}

def generate_handler(parameters):
    url = parameters["url"]
    dataset = parameters["dataset"]
    timestamp_field = parameters["timestamp_field"]
    location_field = parameters["location_field"]
    initial_time_offset = parse_duration(parameters["initial_time_offset"])
    metric_fields = parameters["metric_fields"]
    max_buffer_size = parameters["max_buffer_size"]
    def opendatasoft_live_handler(args):
        client_id = args.get("client_id")
        client_info = clients_info.get(client_id)
        now_minus_offset = dt_to_string(datetime.utcnow() - initial_time_offset)
        if client_info:
            max_record_timestamp = client_info["max_record_timestamp"]
            timestamps = client_info["timestamps"]
            if len(timestamps) > 0:
                first_timestamp = timestamps[0]
            else:
                first_timestamp = now_minus_offset
        else:
            max_record_timestamp = now_minus_offset
            first_timestamp = now_minus_offset
        res = query(url, dataset, first_timestamp, None, max_record_timestamp, timestamp_field, location_field, metric_fields)
        max_record_timestamp = res["max_record_timestamp"]
        if not client_info:
            client_id = uuid()
            res["client_id"] = client_id
            clients_info[client_id] = {}
            clients_info[client_id]["timestamps"] = []
        clients_info[client_id]["max_record_timestamp"] = max_record_timestamp
        clients_info[client_id]["timestamps"] = new_saved_timestamps(clients_info[client_id]["timestamps"], res["timestamps"], max_buffer_size)
        cap_res(res, calc_new_first_timestamp(clients_info[client_id]["timestamps"], res["timestamps"], max_buffer_size))
        return res
    return opendatasoft_live_handler

# pre: len(saved_timestamps + res_timestamps) > 0
def calc_new_first_timestamp(saved_timestamps, res_timestamps, max_buffer_size):
    timestamps = set(saved_timestamps + res_timestamps)
    sorted_timestamps = sorted(timestamps)
    if len(sorted_timestamps) <= max_buffer_size:
        return sorted_timestamps[0]
    else:
        return sorted_timestamps[-max_buffer_size]

# pre: len(saved_timestamps + res_timestamps) > 0
def new_saved_timestamps(saved_timestamps, res_timestamps, max_buffer_size):
    timestamps = set(saved_timestamps + res_timestamps)
    sorted_timestamps = sorted(timestamps)
    if len(sorted_timestamps) <= max_buffer_size:
        return sorted_timestamps
    else:
        return sorted_timestamps[-max_buffer_size:]

def timestamps_new_first_index(timestamps, new_first_timestamp):
    for i in range(len(timestamps)):
        if timestamps[i] >= new_first_timestamp:
            return i

def cap_res(res, new_first_timestamp):
    new_first_index = timestamps_new_first_index(res["timestamps"], new_first_timestamp)
    if new_first_index is None:
        res["timestamps"] = []
        res["values"] = {}
        return
    res["timestamps"] = res["timestamps"][new_first_index:]
    for metric in res["values"]:
        for location in res["values"][metric]:
            res["values"][metric][location] = res["values"][metric][location][new_first_index:]
