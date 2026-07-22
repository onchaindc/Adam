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

## Sprint 2 behavior

Adam performs a shallow, non-interactive Git clone in an isolated temporary
workspace. It never executes repository hooks, scripts, package managers,
builds, tests, containers, or smart contracts.

The response contains:

- normalized repository identity, default branch, and immutable commit SHA;
- detected languages with file counts and percentages;
- frameworks and package manager with confidence and evidence;
- top-level structure, directories, and file tree;
- Docker, CI/CD, Solidity, environment-file, and configuration-file presence;
- total files scanned, ignored directories, and detection limitations.

The workspace is deleted after successful or failed processing.

## Errors

- HTTP 400: invalid request or unsupported repository URL.
- HTTP 422: configured repository scan limit exceeded.
- HTTP 502: the public repository could not be retrieved.

This service does not perform vulnerability detection, AI reasoning, root cause
investigation, or report generation.
