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
store repositories, logs, reports, credentials, or payment proofs.

Fixed-price A2MCP requests do not require session state. Do not enable an
in-memory MPP session store or introduce a database unless a later approved
service requires channel billing.

## Required variables

```text
NODE_ENV=production
HOST=0.0.0.0
LOG_LEVEL=info
STATE_FILE=/data/runtime-state.json
PAYMENTS_ENABLED=false
```

Railway injects `PORT`; do not hardcode it.

To enable the official OKX seller runtime, also set:

```text
PAYMENTS_ENABLED=true
OKX_API_KEY=...
OKX_SECRET_KEY=...
OKX_PASSPHRASE=...
PAY_TO=0x...
AUDIT_PRICE_USD=$0.01
INVESTIGATE_PRICE_USD=$0.01
```

The current official seller SDK supports X Layer mainnet (`eip155:196`) for
this integration. Secrets belong in Railway variables, never in Git.

## Health verification

Railway checks `GET /health`. A healthy production response reports runtime
state plus whether payments are enabled and initialized.

After deployment, verify:

1. `GET /` returns Adam service metadata.
2. `GET /health` returns HTTP 200.
3. With payments disabled, `POST /audit` and `POST /investigate` return the
   documented HTTP 501 placeholder responses.
4. With payments enabled, an unpaid protected request returns the official
   payment challenge before placeholder execution.
