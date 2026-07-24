# Root Cause Investigation Contract

## Route

`POST /investigate`

## Input

```json
{
  "repositoryUrl": "https://github.com/onchaindc/Adam",
  "logs": [
    {
      "source": "build",
      "label": "Railway build",
      "content": "Error: Cannot find module 'express'\nBuild failed"
    }
  ]
}
```

`source` must be one of `build`, `runtime`, `ci`, `stack-trace`, or
`error-message`. Request count, bytes, and normalized lines are bounded by the
`INVESTIGATION_MAX_LOG_*` settings.

## Processing

Adam performs this deterministic pipeline:

1. Receive inputs.
2. Normalize and redact logs.
3. Identify error signals.
4. Correlate Repository Model context.
5. Generate candidate causes.
6. Rank candidates.
7. Select the most probable supported cause.
8. Produce the structured result.

The detector registry supports dependency, environment, configuration, build,
runtime, module-resolution, version, deployment, authentication, database,
external API, and Solidity deployment failures. Unsupported evidence returns a
low-confidence `undetermined` result rather than an invented cause.

## Output

```json
{
  "service": "root-cause-investigation",
  "status": "completed",
  "requestId": "generated-request-id",
  "investigationId": "ADAM-RCI-generated-request-id",
  "repository": {
    "name": "Adam",
    "owner": "onchaindc",
    "url": "https://github.com/onchaindc/Adam",
    "defaultBranch": "main",
    "commitSha": "immutable-sha"
  },
  "rootCause": {
    "category": "module-resolution",
    "title": "Module resolution failed",
    "summary": "The failure is most consistent with an imported module or package that the build/runtime cannot resolve."
  },
  "confidence": {
    "score": 93,
    "level": "high"
  },
  "evidence": [],
  "impact": "The application cannot compile or start because a required import is unavailable at the resolved path.",
  "recommendedFixes": [],
  "prevention": [],
  "relatedFiles": [],
  "relatedDependencies": ["express"],
  "supportingLogEntries": [],
  "pipeline": [
    "receive-inputs",
    "normalize-logs",
    "identify-error-signals",
    "correlate-repository-context",
    "generate-candidate-causes",
    "rank-causes",
    "select-most-probable-cause",
    "produce-investigation-result"
  ],
  "limitations": []
}
```

Adam does not execute repository code or reproduce the deployment. Repository
workspaces and supplied logs remain request-scoped and are not persisted.
