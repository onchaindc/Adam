# Security Audit Contract

## Route

`POST /audit`

## Request

```json
{
  "repositoryUrl": "https://github.com/onchaindc/Adam"
}
```

The repository must satisfy the public GitHub restrictions documented by the
Repository Intelligence contract.

## Sprint 3 behavior

The service acquires the repository, builds the Sprint 2 Repository Model, and
runs these independent deterministic modules:

- Secrets Scanner;
- Dependency Inspector;
- Authentication & Authorization Inspector;
- Configuration Inspector;
- Static Security Pattern Inspector;
- Smart Contract Inspector when Solidity is detected.

## Response

```json
{
  "service": "security-audit",
  "status": "completed",
  "requestId": "generated-request-id",
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
      "confidence": "high"
    }
  ],
  "limitations": []
}
```

Secret evidence is redacted. Dependency inspection is offline and does not
query live package registries or vulnerability databases.

Sprint 3 does not generate a security score, remediation, narrative report,
LLM analysis, or Root Cause Investigation.
