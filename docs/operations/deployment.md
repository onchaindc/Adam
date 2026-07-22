# Railway Deployment

## Service

Create one Railway service from the GitHub repository. Railway uses the root
`Dockerfile` through `railway.json`.

## Persistent state

Attach a Railway Volume to the service and mount it at `/data`. Set:

```text
STATE_FILE=/data/runtime-state.json
```

This file stores operational instance identity and boot count only. It does not
store repositories, logs, reports, or credentials.

## Required variables

```text
NODE_ENV=production
HOST=0.0.0.0
LOG_LEVEL=info
STATE_FILE=/data/runtime-state.json
REPOSITORY_CLONE_TIMEOUT_MS=60000
REPOSITORY_MAX_FILES=10000
REPOSITORY_MAX_DEPTH=25
```

Railway injects `PORT`; do not hardcode it.

Sprint 1 uses a free A2MCP service contract. Register the services with price
`0`; no payment credentials or payment runtime variables are required.

## Health verification

Railway checks `GET /health`. A healthy production response reports runtime
state.

After deployment, verify:

1. `GET /` returns Adam service metadata.
2. `GET /health` returns HTTP 200.
3. `POST /repository/summary` returns HTTP 200 for a small public GitHub
   repository.
4. `POST /audit` and `POST /investigate` return the documented HTTP 501
   placeholder responses.
