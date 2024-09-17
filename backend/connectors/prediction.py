from datetime import datetime
from uuid import uuid4
from ..forecasting.polling_job import run_job_on_new_thread

# stored result with real values and predicted values
result = {}

# increment this variable each time new_data_handler is called
last_data_version = 0

# maps client id to last data version
clients_last_data_version = {}

def new_data_handler(values):
    global result, last_data_version
    result = values
    last_data_version += 1

def generate_handler(parameters):
    model_name = parameters["model_name"]
    model_parameters = parameters["model_parameters"]
    run_job_on_new_thread(new_data_handler, parameters, model_parameters, model_name)
    def prediction_handler(args):
        global result, clients_last_data_version
        if not result:
            return {}
        client_id = args.get("client_id")
        if not client_id:
            client_id = str(uuid4())
            clients_last_data_version[client_id] = -1
            return {"client_id": client_id}
        client_version = clients_last_data_version[client_id]
        if client_version < last_data_version:
            clients_last_data_version[client_id] = last_data_version
            return result
        else:
            return {}
    return prediction_handler
