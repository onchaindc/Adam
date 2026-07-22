export const SERVICE_KINDS = [
  "security-audit",
  "root-cause-investigation",
] as const;

export type ServiceKind = (typeof SERVICE_KINDS)[number];

export interface PlannerDecision {
  readonly service: ServiceKind;
}

export interface PlaceholderServiceRequest {
  readonly requestId: string;
  readonly input: unknown;
}

export interface PlaceholderServiceResponse {
  readonly service: ServiceKind;
  readonly status: "not-implemented";
  readonly requestId: string;
  readonly message: string;
}
