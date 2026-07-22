# Contributing

## Requirements

- Node.js 22 or newer
- pnpm 11.15.1 through Corepack
- Docker for container verification

## Setup

```powershell
corepack enable
pnpm install
Copy-Item .env.example .env
pnpm dev
```

## Required checks

```powershell
pnpm verify
docker build -t adam:sprint-1 .
```

## Architecture boundaries

- The planner selects a service only.
- Service modules do not depend on HTTP transport modules.
- A2MCP monetization must not be introduced without an approved architecture
  decision.
- Sprint 1 must not contain repository ingestion, analyzers, AI reasoning, or
  report generation.
- Secrets and raw user inputs must not be logged.
