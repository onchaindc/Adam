#!/bin/sh
set -eu

# Railway mounts volumes after image construction, so initialize ownership at boot.
chown -R adam:adam /data

exec gosu adam "$@"
