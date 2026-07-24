import {
  SERVICE_KINDS,
  type PlannerDecision,
  type ServiceKind,
} from "@adam/contracts";

export interface PlannerRequest {
  readonly requestedService: ServiceKind;
}

export function planRequest(request: PlannerRequest): PlannerDecision {
  if (!SERVICE_KINDS.includes(request.requestedService)) {
    throw new Error(`Unsupported service: ${String(request.requestedService)}`);
  }

  return {
    service: request.requestedService,
    prerequisites:
      request.requestedService === "repository-intelligence" ||
      request.requestedService === "pull-request-review"
        ? []
        : ["repository-intelligence"],
  };
}
