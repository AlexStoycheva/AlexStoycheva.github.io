import time
import random
import datetime
import requests

API_URL = "http://0.0.0.0:8000/ingest/ecowitt"

PASSKEY = "MY-TEST-PASS-KEY"

def f_to_str(f):
    return f"{f:.2f}"

def generate_temperature_f():
    return random.uniform(65, 80)

def format_ecowitt_ts():
    return datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%d %H:%M:%S")


while True:
    temp_f = generate_temperature_f()

    payload = {
        "PASSKEY": PASSKEY,
        "stationtype": "SIMULATOR_V1",
        "runtime": str(random.randint(1000, 999999)),
        "heap": "24716",
        "dateutc": format_ecowitt_ts(),

        "tempinf": f_to_str(temp_f),
        "humidityin": str(random.randint(30, 60)),

        "baromrelin": f_to_str(random.uniform(27.5, 28.5)),

        "batt1": "0",
        "freq": "868M",
        "model": "SIMULATOR",
        "interval": "300"
    }

    try:
        response = requests.post(API_URL, data=payload)
    except Exception as e:
        print(f"Error: {e}")

    time.sleep(300)