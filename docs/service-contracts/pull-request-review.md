# Pull Request Review Contract

## Route

`POST /review-pr`

## Inputs

URL form:

```json
{
  "pullRequest": "https://github.com/onchaindc/Adam/pull/3",
  "analysisMode": "deterministic"
}
```

Coordinate form:

```json
{
  "owner": "onchaindc",
  "repo": "Adam",
  "pullNumber": 3,
  "analysisMode": "intelligent"
}
```

Only public GitHub repositories are supported. `analysisMode` defaults to
`deterministic`.

## Analysis Flow

```text
Validate PR reference
        |
        v
Fetch metadata and changed files from GitHub
        |
        v
Write available changed-file head content to an ephemeral workspace
        |
        v
Build a changed-file-only Repository Model
        |
        v
Run the existing deterministic Security Audit pipeline
        |
        v
Resolve scoring, evidence, and traceable recommendations
        |
        v
Optionally invoke the existing evidence-constrained AI layer
        |
        v
Return the structured PR review and delete the workspace
```

The service does not clone the repository. Removed files, binary files, and
files without available head content remain in `changedFiles` but cannot be
statically inspected.

## Response

```json
{
  "service": "pull-request-review",
  "status": "completed",
  "requestId": "generated-request-id",
  "analysisMode": "deterministic",
  "pullRequest": {
    "owner": "onchaindc",
    "repository": "Adam",
    "number": 3,
    "title": "Example change",
    "baseBranch": "main",
    "headBranch": "feature/example",
    "commitCount": 1,
    "changedFileCount": 2,
    "additions": 20,
    "deletions": 4
  },
  "summary": {
    "filesChanged": 2,
    "filesAnalyzed": 2,
    "filesWithPatches": 2,
    "filesWithoutContent": 0,
    "additions": 20,
    "deletions": 4,
    "limitations": []
  },
  "repositorySummary": {},
  "riskRating": "low",
  "securityScore": {},
  "changedFiles": [],
  "findings": [],
  "recommendations": [],
  "traceability": {},
  "aiReview": null
}
```

Risk rating, score, findings, and recommendations come from the existing
Security Audit workflow. The PR service does not create or alter security
rules.

## Intelligent Mode

When OpenAI is configured, the existing AI Intelligence Engine may explain and
prioritize deterministic finding IDs into security observations, possible
bugs, maintainability concerns, breaking-change risks, and code-quality
comments.

The AI layer cannot add findings, files, lines, or evidence. If AI is disabled
or temporarily unavailable, the endpoint still returns HTTP 200 with the
deterministic review, `aiReview: null`, and an explicit limitation.
