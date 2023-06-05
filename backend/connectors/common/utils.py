from datetime import timedelta, datetime
from uuid import uuid4

# parses string in 'xu' format, where x is an int and u is one of (m, h, d, w)
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

# serializes datetime object for influxdb query
def dt_to_string(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

def uuid():
    return str(uuid4())

def parse_date(datestr):
    splits = datestr.split(".")
    if len(splits) > 1:
        datestr = splits[0] + "Z"
    return datetime.strptime(datestr, "%Y-%m-%dT%H:%M:%SZ")

def array_put_at(arr, index, value):
    if len(arr) > index:
        arr[index] = value
    else:
        for _ in range(len(arr), index):
            arr.append(None)
        arr.append(value)

def array_pad(arr, length):
    for _ in range(len(arr), length):
        arr.append(None)
