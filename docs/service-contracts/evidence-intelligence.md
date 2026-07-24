# Evidence Traceability and AI Intelligence

## Traceability flow

```text
Deterministic finding
        |
        v
Evidence Link Resolver
        |
        +--> finding ID and evidence ID
        +--> repository file and line numbers
        +--> rule ID, confidence, and source service
        |
        v
Traceable recommendation
```

`recommendations` and `traceability` are authoritative. Existing string arrays
remain compatibility views. No canonical recommendation is returned without
supporting evidence.

## Analysis modes

`deterministic` is the default and makes no external model call.
`intelligent` runs the same deterministic pipeline first, then sends only
existing findings and sanitized evidence to the optional provider.

The AI response contains Executive Summary, Developer Summary, Business Impact,
Attack Narrative, Remediation Strategy, Priority Roadmap, Architecture
Observations, and Confidence Summary. Every section must reference supplied
finding IDs. Unknown IDs, invalid JSON, and missing ID references fail closed.

## AI reasoning flow

```text
Deterministic response
        |
        v
Evidence Traceability Engine
        |
        v
Prompt Builder
        |
        v
Bounded cache lookup
        |
        v
Optional provider adapter
        |
        v
Reasoning Formatter and ID validation
        |
        v
Intelligent response
```

The Planner makes at most one AI call after all selected services finish.
Direct audit and investigation requests make at most one call. Identical
evidence packages use a bounded process-local TTL cache, and the repository is
never rescanned only for AI reasoning.

AI intelligence cannot create findings, files, lines, evidence, or rule IDs.
It cannot alter deterministic severity, confidence, scores, or root-cause
selection. If evidence is insufficient, it must state that limitation.
