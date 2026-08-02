# Security Audit Contract

## Route

`POST /audit`

## Request

```json
{
  "repositoryUrl": "https://github.com/onchaindc/Adam",
  "analysisMode": "deterministic",
  "securityProfile": "live"
}
```

The repository must satisfy the public GitHub restrictions documented by the
Repository Intelligence contract.
`analysisMode` is optional and accepts `deterministic` or `intelligent`.
`securityProfile` is optional and accepts:

- `static` (default): repository inspection without external vulnerability
  queries or repository code execution;
- `live`: static inspection plus exact-version advisory lookup through OSV and
  bounded secret scanning across the acquired default-branch Git history;
- `sandboxed`: live inspection plus supported Node.js build and test commands
  inside a constrained Docker sandbox.

## Security audit behavior

The service acquires the repository, builds the Sprint 2 Repository Model, and
runs the Sprint 3 independent deterministic modules:

- Secrets Scanner;
- Dependency Inspector;
- Authentication & Authorization Inspector;
- Configuration Inspector;
- Static Security Pattern Inspector;
- Smart Contract Inspector when Solidity is detected.

The Static Security Pattern Inspector also consumes the canonical
language-rule registry for Rust, Go, Python, Java, Kotlin, Swift, C, C++, C#,
and PHP. These deterministic rules emit the existing finding schema and reuse
the existing scoring, evidence, traceability, recommendation, audit, pull
request review, and Planner paths.

The Security Intelligence Layer then:

- generates evidence-bound analysis for every existing finding;
- computes deterministic category and overall scores;
- assigns an overall risk rating;
- orders recommended fixes;
- assembles a structured professional Security Report.

## Response

```json
{
  "service": "security-audit",
  "status": "completed",
  "requestId": "generated-request-id",
  "analysisMode": "deterministic",
  "securityProfile": "live",
  "repository": {
    "name": "Adam",
    "owner": "onchaindc",
    "url": "https://github.com/onchaindc/Adam",
    "defaultBranch": "main",
    "commitSha": "immutable-commit-sha"
  },
  "modulesExecuted": ["secrets", "dependencies", "configuration"],
  "filesAnalyzed": 42,
  "findings": [
    {
      "id": "ADAM-SEC-0001",
      "ruleId": "STATIC-EVAL",
      "category": "static-pattern",
      "title": "Dynamic code evaluation",
      "severity": "high",
      "file": "src/worker.ts",
      "line": 18,
      "description": "Source text is executed dynamically with eval.",
      "evidence": "const result = eval(input);",
      "confidence": "high",
      "intelligence": {
        "explanation": "ADAM-SEC-0001 identifies \"Dynamic code evaluation\" at src/worker.ts:18. Source text is executed dynamically with eval. The recorded evidence is: const result = eval(input);",
        "whyItMatters": "eval executes text as code in the current JavaScript context.",
        "potentialImpact": "Arbitrary code execution with application privileges if untrusted data reaches the call.",
        "likelihood": "medium",
        "suggestedRemediation": "Remove eval or replace it with a constrained parser and an explicit allowlist of supported operations.",
        "confidenceLevel": "high",
        "evidenceReferences": ["ADAM-SEC-0001"]
      }
    }
  ],
  "securityScore": {
    "value": 77,
    "maximum": 100,
    "scoringVersion": "1.0",
    "riskRating": "high",
    "categoryScores": []
  },
  "overallRiskRating": "high",
  "recommendations": [],
  "traceability": {
    "complete": true,
    "findings": [],
    "evidence": [],
    "recommendations": []
  },
  "coverage": {
    "schemaVersion": "1.0",
    "assurance": "moderate",
    "checks": [
      {
        "id": "repository-snapshot",
        "name": "Repository snapshot",
        "status": "completed",
        "summary": "42 files were mapped at commit immutable-commit-sha.",
        "limitation": "Local, untracked, gitignored, deleted, and deployment-only files are outside the acquired snapshot."
      },
      {
        "id": "git-history-secrets",
        "name": "Git-history secret scanning",
        "status": "partial",
        "summary": "100 commits scanned; 1 historical secret finding produced.",
        "limitation": "Git-history secret scanning is bounded to the most recent 100 commits on the acquired default branch; older commits, other branches, forks, and cached copies are not covered."
      }
    ]
  },
  "enrichment": {
    "liveVulnerabilities": {
      "status": "completed",
      "provider": "OSV",
      "queriedAt": "2026-07-29T00:00:00.000Z",
      "packagesChecked": 48,
      "advisoriesFound": 2,
      "limitation": null
    },
    "gitHistorySecrets": {
      "status": "partial",
      "commitsScanned": 100,
      "findingsFound": 1,
      "depthLimit": 100,
      "limitation": "Git-history secret scanning is bounded to the most recent 100 commits on the acquired default branch; older commits, other branches, forks, and cached copies are not covered."
    },
    "runtimeAnalysis": {
      "status": "not-requested",
      "sandbox": "docker",
      "checks": [],
      "limitation": null
    }
  },
  "aiIntelligence": null,
  "recommendedFixOrder": [
    {
      "priority": 1,
      "findingId": "ADAM-SEC-0001",
      "title": "Dynamic code evaluation",
      "severity": "high",
      "rationale": "ADAM-SEC-0001 is ranked as high severity with medium likelihood and high confidence.",
      "suggestedRemediation": "Remove eval or replace it with a constrained parser and an explicit allowlist of supported operations."
    }
  ],
  "report": {
    "schemaVersion": "1.0",
    "repositoryOverview": {},
    "technologyStack": {},
    "securityScore": {},
    "overallRiskRating": "high",
    "criticalFindings": [],
    "highFindings": [],
    "mediumFindings": [],
    "lowFindings": [],
    "recommendedFixOrder": [],
    "securitySummary": {},
    "limitations": []
  },
  "limitations": []
}
```

Secret evidence is redacted. The default `static` profile remains offline and
snapshot-only. Repository snapshot analysis includes only files present in the
fetched Git commit. Local, untracked, gitignored, and deployment-only files are
not visible to the service and are identified as a limitation in every report.
The `live` and `sandboxed` profiles send exact package ecosystem, name, and
version coordinates extracted from supported lockfiles to OSV. `queriedAt`
records when that lookup was performed, so advisory results are time-bound.
They also inspect added lines in a bounded number of commits from the acquired
default branch. This can identify a credential that was committed and later
deleted, but does not cover commits outside the configured depth, other
branches, forks, rewritten history, or cached copies.

Sandboxed analysis is opt-in and fail-closed. Adam never executes repository
code directly on the host. A deployment must enable the runtime sandbox and
provide Docker plus a trusted configured image. Dependency installation runs
with lifecycle scripts disabled. Build and test checks then run without
network access in containers with a read-only root filesystem, dropped Linux
capabilities, `no-new-privileges`, and configured memory, CPU, PID, and time
limits. Unsupported repositories or unavailable Docker produce a structured
`skipped` result.

Language-specific rules and sandbox results improve evidence but do not prove
runtime reachability or exploitability.

## Coverage and assurance

Every response includes a `coverage` object. Its checks report whether
repository snapshot analysis, deterministic static analysis, live dependency
advisories, Git-history secret scanning, and sandboxed runtime validation were
completed, partial, failed, skipped, or not requested.

`coverage.assurance` summarizes breadth, not the absence of vulnerabilities:

- `limited`: snapshot/static coverage, or a requested enrichment did not reach
  the requirements for moderate assurance;
- `moderate`: live advisories completed and Git-history scanning completed or
  returned bounded partial coverage;
- `strong`: sandboxed runtime checks, live advisories, and Git-history scanning
  all completed.

A `100/100` security score means no scored findings were detected within the
reported coverage. It does not guarantee that the repository or deployed
system is vulnerability-free.

## Scoring methodology

Scoring version `1.0` is deterministic:

- each applicable category begins at `100`;
- critical findings deduct `35`, high `20`, medium `10`, and low `4`;
- the deduction is multiplied by detection confidence: high `1.0`, medium
  `0.75`, low `0.5`;
- the deduction is multiplied by likelihood: high `1.0`, medium `0.8`, low
  `0.6`;
- category scores cannot fall below `0`;
- the overall score is a weighted average of applicable categories;
- Secrets and Smart Contracts use weight `1.4`;
- Authentication and Authorization use weight `1.2`;
- Application Security uses weight `1.1`;
- Dependencies and Configuration use weight `1.0`.

Risk ratings use score thresholds, finding severity, analysis confidence, and
likelihood so averaging cannot hide a credible critical result or let a
low-likelihood documentation/example pattern overstate risk. A critical
finding with medium or high analysis confidence and non-low likelihood
produces at least a Critical overall rating.

## Evidence rules

- intelligence can only enrich findings produced by the Security Audit Engine;
- each explanation includes the finding ID and source location;
- `evidenceReferences` contains the actual finding ID;
- no new vulnerability IDs are generated by the intelligence layer;
- potential impact remains conditional when reachability is unknown.

Intelligent mode can explain or prioritize only the deterministic finding IDs
included in this response. It cannot add findings or change the score.
