# Official Documentation Review

Reviewed on **July 22, 2026** for Adam Milestone 0.

Only official OKX, OnchainOS, Railway, GitHub, Node.js, and protocol-maintainer
sources should be used for implementation decisions. Community tutorials may
help discovery but must not define production behavior.

## OKX.AI and OnchainOS

### OnchainOS overview

- [What is OnchainOS?](https://web3.okx.com/onchainos/dev-docs/home/what-is-onchainos)

Used to establish the role of OnchainOS tooling and the broader agent-oriented
platform. It does not state that OnchainOS hosts an ASP's custom application
runtime.

### OKX.AI overview

- [What Is OKX.AI?](https://web3.okx.com/onchainos/dev-docs/okxai/what-is-okxai)

Used to establish the User, Agent Service Provider, and Evaluator roles.

### ASP overview and registration

- [ASP overview](https://web3.okx.com/onchainos/dev-docs/okxai/asp)
- [ASP registration](https://web3.okx.com/onchainos/dev-docs/okxai/registerasp)

Used to establish OKX Agent Identity registration, service registration,
endpoint metadata, pricing, and the documented A2A/A2MCP service mode
distinction.

### A2MCP

- [A2MCP](https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp)

Used to establish A2MCP as the standardized API-oriented service mode and the
expected public HTTP endpoint. The official flow supports either a free
endpoint that returns HTTP 200 directly or an optional x402-protected paid
endpoint. Adam uses the free mode in Sprint 1.

### A2A

- [A2A](https://web3.okx.com/onchainos/dev-docs/okxai/how-to-become-a2a)

Used only to understand the official distinction between customized,
multi-step task work and standardized A2MCP services. Adam is not implementing
an A2A runtime in the approved Milestone 0 proposal.

## Optional x402 payments

These sources are retained only for a possible future monetization decision.
They do not define the required A2MCP runtime and no payment SDK is integrated
in Sprint 1.

### SDK overview

- [Payment SDK Overview](https://web3.okx.com/onchainos/dev-docs/payments/sdk-overview)

Used to understand the optional paid HTTP seller model.

### HTTP seller integration

- [Sell DApp/MCP services](https://web3.okx.com/onchainos/dev-docs/payments/service-seller)

Used to establish the seller-side flow only if a future paid service is
explicitly approved.

### Broker and protocol concepts

- [Core Concepts](https://web3.okx.com/onchainos/dev-docs/payments/core-concept)

Used to establish the Challenge and Credential messages and the Broker role.
For one-time HTTP payment, the Broker occupies the same architectural slot as
an x402 facilitator. Network, asset, and Broker selection remain deployment
decisions.

## Hackathon

- [OKX.AI Genesis Hackathon](https://web3.okx.com/xlayer/build-x-series)

Used to confirm the official campaign context and that ASP registration and
service activation are part of the submission flow.

### Date discrepancy

The official page was inconsistent during the July 22, 2026 review:

- several localized/current result views and the application form described an
  end date of **July 27, 2026 at 23:59 UTC**;
- one English result view described an end date of **July 17, 2026**.

Because July 17, 2026 is already past and the official pages conflict, the
participant dashboard or direct organizer confirmation should be used for the
actual submission deadline.

## Railway

### Deployments

- [Deployments](https://docs.railway.com/deployments)
- [Dockerfiles](https://docs.railway.com/builds/dockerfiles)
- [Config as Code](https://docs.railway.com/reference/config-as-code)

Used to support a reproducible container deployment and version-controlled
service configuration.

### Runtime

- [Public Networking](https://docs.railway.com/networking/public-networking)
- [Private Networking](https://docs.railway.com/networking/private-networking)
- [Healthchecks](https://docs.railway.com/reference/healthchecks)
- [Restart Policy](https://docs.railway.com/reference/restart-policy)

Used to define the public HTTPS service, future private worker communication,
readiness path, and restart behavior.

### Persistence

- [Volumes](https://docs.railway.com/volumes)
- [Backups](https://docs.railway.com/volumes/backups)

Used to establish that persistent storage is an explicit attached resource.
Adam's initial bounded service does not require a volume and treats deployment
filesystems as ephemeral.

## Repository status checked during review

The brief provided `https://githum.com/onchaindc/Adam`, which appears to contain
a hostname typo. The inferred URL is:

- [onchaindc/Adam](https://github.com/onchaindc/Adam)

That inferred repository returned a public `404` during the review. The local
repository at `C:\Users\hp\Documents\ADAM` also has no commits and no configured
`origin`.

Before the first push, confirm whether the repository is private, not yet
created, or has a different owner/name.

## Mandatory revalidation points

Official platform behavior can change. Reopen the relevant official page before
each implementation milestone:

1. Before ASP registration, recheck identity, role, service metadata, and CLI
   commands.
2. Before any separately approved payment integration, recheck package names, supported Node.js
   versions, Broker configuration, headers, networks, and assets.
3. Before Railway deployment, recheck health-check, networking, volume, and
   configuration behavior.
4. Before hackathon submission, verify the deadline and submission fields in
   the authenticated participant dashboard.

If an official example conflicts with current reference documentation, stop and
resolve the conflict rather than selecting the more convenient behavior.
