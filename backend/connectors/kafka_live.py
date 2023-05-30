from confluent_kafka import Consumer
from flask import request, jsonify
import json

# ****************
# Connector exports
# ****************
def generate_handler(parameters):
    server = parameters["server"]
    topic = parameters["topic"]
    def kafka_live_handler():
        client_id = request.args.get("client_id")
        if client_id:
            client_id = int(client_id)
        else: # new client
            client_id = new_consumer(server, topic)
        return jsonify(fetch(topic, client_id))
    return kafka_live_handler

# ****************
# Internal code
# ****************
MAX_MOMENTS_RETURNED = 20

# maps topic to list of consumers
consumers = {}

def new_consumer(server, topic):
    if topic not in consumers:
            consumers[topic] = []
    consumer_index = len(consumers[topic])
    consumer_group = "crowd-vis-{}-{}".format(topic, consumer_index)
    consumer = Consumer({'bootstrap.servers':server,'group.id':consumer_group,'auto.offset.reset':'earliest'})
    consumer.subscribe([topic])
    consumers[topic].append(consumer)
    return consumer_index

def poll(topic, consumer_index):
    consumer = consumers[topic][consumer_index]
    messages = []
    while True:
        msg=consumer.poll(1.0) #timeout
        if msg is None:
            break
        if msg.error():
            print('Error polling from kafka topic "{}": {}'.format(topic, msg.error()))
            continue
        measurements=json.loads(msg.value().decode('utf-8'))
        timestamp = msg.key().decode('utf-8')
        data = {"measurements": measurements, "timestamp": timestamp}
        messages.append(data)
    return messages[-MAX_MOMENTS_RETURNED:]


def fetch(topic, consumer_index):
    messages = poll(topic, consumer_index)
    res = {"timestamps": [], "measurements": {}, "client_id": consumer_index}
    for message in messages:
        res["timestamps"].append(message["timestamp"])
        for measurement in message["measurements"]:
            if measurement not in res["measurements"]:
                res["measurements"][measurement] = []
            res["measurements"][measurement].append(message["measurements"][measurement])
    return res
