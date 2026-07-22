# ADR 0001: Modular Monolith

- Status: Accepted
- Date: 2026-07-22

## Decision

Adam starts as one deployable API service with explicit internal module
boundaries and one shared contracts package.

## Rationale

Sprint 1 needs reliable deployment, payment runtime integration, request
routing, and operational state. Separate network services would add failure
modes without providing a current scaling benefit. The workspace preserves
clear package ownership while allowing measured workloads to be extracted
later.

## Consequences

- The API is one Railway service.
- The planner cannot import service execution, payment, or transport modules.
- Services cannot import payment or transport modules.
- Future extraction must be justified by observed isolation or scaling needs.
