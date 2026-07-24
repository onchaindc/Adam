# Planner and Service Orchestration Contract

## Route

`POST /plan`

## Architecture

```text
Natural-language request
        |
        v
Intent Classifier
        |
        v
Execution Planner
        |
        v
Dependency Resolution
        |
        v
Shared Execution Context + Repository Model
        |
        v
Service Orchestrator
        |
        +--> Repository Intelligence
        +--> Security Audit
        +--> Root Cause Investigation
        +--> Pull Request Review
        |
        v
Response Aggregator
        |
        v
Unified deterministic response
```

The Planner coordinates approved services only. It does not inspect source,
create findings, alter security scores, or generate root-cause candidates.

## Input

```json
{
  "request": "Audit this repository and explain why deployment failed",
  "repositoryUrl": "https://github.com/onchaindc/Adam",
  "analysisMode": "deterministic",
  "logs": [
    {
      "source": "build",
      "label": "Railway build",
      "content": "Error: Cannot find module 'express'"
    }
  ]
}
```

`logs` is optional for repository and security requests. An explicit
Root Cause Investigation requires at least one bounded log. Broad combined
requests without logs omit Root Cause Investigation and record the reason.
`analysisMode` is optional and defaults to `deterministic`.

Pull request requests may replace `repositoryUrl` with either
`pullRequest` or the complete `owner`, `repo`, and `pullNumber` coordinate
set.

## Deterministic intent examples

| Request | Intent | Execution |
| --- | --- | --- |
| `Audit this repository` | `security-audit` | Repository Intelligence, Security Audit |
| `Why is my build failing?` | `root-cause-investigation` | Repository Intelligence, Root Cause Investigation |
| `Analyze this repository` | `combined-analysis` | Repository Intelligence, Security Audit; Root Cause Investigation when logs exist |
| `Show the repository structure` | `repository-analysis` | Repository Intelligence |
| `Review this pull request` | `pull-request-review` | Pull Request Review |
| `Inspect PR #25` | `pull-request-review` | Pull Request Review |

## Shared context

One request-scoped context contains:

- Repository Model and metadata;
- bounded log inputs;
- service results;
- execution timeline;
- planner decisions.

The repository is acquired and scanned once. Every planned service consumes the
same immutable Repository Model and records its result into the context.

Pull Request Review is the exception to full-repository acquisition: its
service builds the shared model from changed files only, and execution metadata
records zero repository clones.

## Output

```json
{
  "service": "planner",
  "status": "completed",
  "requestId": "generated-request-id",
  "analysisMode": "deterministic",
  "requestSummary": {
    "request": "Audit this repository",
    "intent": "security-audit",
    "confidence": "medium"
  },
  "plannerDecision": {
    "classification": {},
    "executionPlan": {},
    "decisions": []
  },
  "servicesExecuted": [
    "repository-intelligence",
    "security-audit"
  ],
  "repositoryOverview": {},
  "securityAssessment": {},
  "rootCauseInvestigation": null,
  "pullRequestReview": null,
  "overallRisk": {
    "rating": "low",
    "basis": "Overall risk is the approved deterministic Security Audit risk rating."
  },
  "overallRecommendations": [],
  "recommendations": [],
  "traceability": {
    "complete": true,
    "findings": [],
    "evidence": [],
    "recommendations": []
  },
  "aiIntelligence": null,
  "executionMetadata": {
    "timeline": [],
    "sharedRepositoryModel": true,
    "repositoryAcquisitions": 1
  }
}
```

Recommendations are deduplicated from existing service outputs. If Security
Audit is not executed, `overallRisk.rating` is `not-assessed`; the Planner does
not infer a security rating from repository or root-cause data.

Intelligent mode is invoked once after deterministic service aggregation. It
does not rescan the repository or re-run service engines.

For pull request intent, the Planner executes only `pull-request-review` and
returns its result in `pullRequestReview`. The PR service owns the optional AI
invocation so the deterministic changed-file scan is never repeated.
