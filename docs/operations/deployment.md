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
REPOSITORY_MAX_FILE_BYTES=512000
REPOSITORY_MAX_TOTAL_SOURCE_BYTES=10000000
INVESTIGATION_MAX_LOG_INPUTS=20
INVESTIGATION_MAX_LOG_BYTES=200000
INVESTIGATION_MAX_LOG_LINES=5000
GITHUB_API_TIMEOUT_MS=30000
OSV_API_URL=https://api.osv.dev
OSV_API_TIMEOUT_MS=20000
OSV_MAX_PACKAGES=500
OSV_MAX_ADVISORIES=100
GIT_HISTORY_MAX_COMMITS=100
GIT_HISTORY_TIMEOUT_MS=30000
GIT_HISTORY_MAX_PATCH_BYTES=5000000
RUNTIME_SANDBOX_ENABLED=false
RUNTIME_SANDBOX_IMAGE=node:24.18.0-bookworm-slim
RUNTIME_SANDBOX_TIMEOUT_MS=90000
RUNTIME_SANDBOX_MEMORY_MB=768
RUNTIME_SANDBOX_CPUS=1
RUNTIME_SANDBOX_PIDS=128
RUNTIME_SANDBOX_MAX_PACKAGES=4
PULL_REQUEST_MAX_FILES=300
PULL_REQUEST_MAX_PATCH_BYTES=5000000
AI_PROVIDER=disabled
OPENAI_MODEL=gpt-5.6-sol
GEMINI_MODEL=gemini-3.6-flash
AI_REQUEST_TIMEOUT_MS=60000
AI_CACHE_TTL_MS=300000
AI_CACHE_MAX_ENTRIES=100
```

Railway injects `PORT`; do not hardcode it.

`GITHUB_TOKEN` is optional for public pull request review and can be added as a
Railway secret to increase GitHub API rate limits. It does not enable private
repository support.

The Security Audit defaults to `securityProfile=static`, which fetches one
commit and performs snapshot-only analysis. The `live` profile uses OSV to
query current advisories for exact package versions and fetches bounded
default-branch history for secret scanning. Responses are time-stamped and
bounded by the configured package, advisory, Git commit, patch-byte, and
timeout limits. The `sandboxed` profile uses the same history and advisory
coverage before attempting isolated runtime checks.

Increasing `GIT_HISTORY_MAX_COMMITS` increases clone and analysis work.
History scanning covers the acquired default branch only; reports disclose
partial coverage when the clone is shallow or the patch-byte limit is reached.

The `sandboxed` profile requires `RUNTIME_SANDBOX_ENABLED=true`, Docker daemon
access, and a trusted configured image. A normal Railway service does not
expose a Docker daemon by default, so enable this only with an isolated Docker
worker or equivalent trusted execution environment. Adam refuses host
execution when Docker is unavailable.

Sandbox preparation may use network access to install locked dependencies with
lifecycle scripts disabled. Build and test execution uses no network, a
read-only root filesystem, dropped capabilities, `no-new-privileges`, and the
configured time, memory, CPU, and PID limits. These checks improve runtime
evidence but do not prove vulnerability reachability or exploitability.

To enable intelligent mode, choose one provider:

- OpenAI: set `AI_PROVIDER=openai` and add `OPENAI_API_KEY`.
- Gemini: set `AI_PROVIDER=gemini` and add `GEMINI_API_KEY` or
  `GOOGLE_API_KEY`. When both Gemini key names exist, `GOOGLE_API_KEY` takes
  precedence.

All keys must be Railway secrets. Deterministic mode requires no model
credentials. If the selected provider lacks credentials, Adam remains online
and intelligent audit, investigation, and planner requests fail closed with
HTTP 503 `ai-not-configured`.

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
4. `POST /audit` returns HTTP 200 with enriched findings, explicit coverage and
   assurance metadata, a versioned security score, recommended fix order, and
   structured report.
5. `POST /investigate` returns HTTP 200 with a structured, evidence-backed
   investigation result for a valid public repository and bounded logs.
6. `POST /plan` returns HTTP 200 with deterministic intent classification,
   a dependency-ordered execution plan, one shared repository acquisition,
   executed service outputs, and a unified response.
7. `POST /review-pr` returns HTTP 200 and analyzes only changed files for a
   public GitHub pull request.
8. `POST /plan` routes pull request language to the PR Review workflow with
   zero full-repository acquisitions.
9. Every canonical recommendation includes finding and evidence links.
10. With `AI_PROVIDER=disabled`, intelligent PR review falls back to a
    deterministic HTTP 200 response with `aiReview: null`. Existing intelligent
    audit, investigation, and planner requests retain their established
    `ai-not-configured` behavior.
