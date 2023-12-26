from .common.opendatasoft import query

def generate_handler(parameters):
    url = parameters["url"]
    dataset = parameters["dataset"]
    timestamp_field = parameters["timestamp_field"]
    location_field = parameters["location_field"]
    metric_fields = parameters["metric_fields"]
    def opendatasoft_history_handler(args):
        start = args.get("start")
        end = args.get("end")
        res = query(url, dataset, start, end, None, timestamp_field, location_field, metric_fields)
        return res
    return opendatasoft_history_handler
