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

## Provider Selection

`AI_PROVIDER` selects the provider at process startup:

| Value | Credential | Model variable |
| --- | --- | --- |
| `disabled` | none | none |
| `openai` | `OPENAI_API_KEY` | `OPENAI_MODEL` |
| `gemini` | `GEMINI_API_KEY` or `GOOGLE_API_KEY` | `GEMINI_MODEL` |

OpenAI uses the Responses API. Gemini uses the Interactions API. Both adapters
implement the same internal `AiReasoningProvider` interface, request structured
JSON, disable provider-side storage, and feed output through the same strict
Reasoning Formatter.

Provider credentials are optional at configuration-parse time so Adam can
start safely. Selecting a provider without its credential creates no provider
adapter, and intelligent audit, investigation, and planner requests return
HTTP 503 `ai-not-configured` instead of falling through to another provider.

The Planner makes at most one AI call after all selected services finish.
Direct audit and investigation requests make at most one call. Identical
evidence packages use a bounded process-local TTL cache, and the repository is
never rescanned only for AI reasoning.

AI intelligence cannot create findings, files, lines, evidence, or rule IDs.
It cannot alter deterministic severity, confidence, scores, or root-cause
selection. If evidence is insufficient, it must state that limitation.
