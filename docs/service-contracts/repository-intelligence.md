# Repository Intelligence Contract

## Route

`POST /repository/summary`

## Request

```json
{
  "repositoryUrl": "https://github.com/onchaindc/Adam"
}
```

Only credential-free HTTPS URLs identifying one public repository on
`github.com` are accepted.

## Repository intelligence behavior

Adam performs a shallow, non-interactive Git clone in an isolated temporary
workspace. It never executes repository hooks, scripts, package managers,
builds, tests, containers, or smart contracts.

The response contains:

- normalized repository identity, default branch, and immutable commit SHA;
- `languages` and backward-compatible `detectedLanguages` records with file
  counts, percentages, confidence, and source or manifest evidence;
- frameworks and package manager with confidence and evidence;
- top-level structure, directories, and file tree;
- Docker, CI/CD, Solidity, environment-file, and configuration-file presence;
- total files scanned, ignored directories, and detection limitations.

The workspace is deleted after successful or failed processing.

First-class language evidence is supported for Rust, Go, Python, Java, Kotlin,
Swift, C, C++, C#, and PHP in addition to the existing JavaScript,
TypeScript, Solidity, and other extension-based detections. Mixed-language
repositories return every language supported by the available evidence.

## Errors

- HTTP 400: invalid request or unsupported repository URL.
- HTTP 422: configured repository scan limit exceeded.
- HTTP 502: the public repository could not be retrieved.

This service does not perform vulnerability detection, AI reasoning, root cause
investigation, or report generation.
