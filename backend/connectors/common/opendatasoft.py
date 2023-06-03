from urllib.request import urlopen
import json

def fetch_records(url):
    next_url = url
    while next_url:
        res = json.loads(urlopen(next_url).read())
        for element in res["records"]:
            yield element["record"]
        next_url = get_next_url(res)

def get_next_url(res):
    for link in res["links"]:
        if link["rel"] == "next":
            return link["href"]
