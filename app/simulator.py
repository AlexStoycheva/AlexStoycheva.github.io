import time
import random
import datetime
import requests

API_URL = "http://localhost:8000/measurements"

SENSOR_ID = 1


def generate_temperature():
    return round(random.uniform(20, 27), 2)


while True:
    payload = {
        "sensor_id": SENSOR_ID,
        "ts": datetime.datetime.now(datetime.UTC).isoformat(),
        "value": generate_temperature(),
    }

    try:
        response = requests.post(API_URL, json=payload)
        print(f"Sent: {payload} | Status: {response.status_code}")
    except Exception as e:
        print(f"Error: {e}")

    time.sleep(5)