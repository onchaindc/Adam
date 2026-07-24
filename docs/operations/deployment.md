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
4. `POST /audit` returns HTTP 200 with enriched findings, a versioned security
   score, recommended fix order, and structured report.
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
