import subprocess
import yaml


def load(payload: str):
    exec(payload)
    subprocess.run(payload, shell=True)
    return yaml.load(payload)
