import type {
  PlaceholderServiceRequest,
  PlaceholderServiceResponse,
} from "@adam/contracts";

export interface PlaceholderService {
  execute(
    request: PlaceholderServiceRequest,
  ): Promise<PlaceholderServiceResponse>;
}

export class SecurityAuditPlaceholderService implements PlaceholderService {
  public async execute(
    request: PlaceholderServiceRequest,
  ): Promise<PlaceholderServiceResponse> {
    return {
      service: "security-audit",
      status: "not-implemented",
      requestId: request.requestId,
      message: "Security Audit will be implemented in a later sprint.",
    };
  }
}

export class RootCauseInvestigationPlaceholderService
  implements PlaceholderService
{
  public async execute(
    request: PlaceholderServiceRequest,
  ): Promise<PlaceholderServiceResponse> {
    return {
      service: "root-cause-investigation",
      status: "not-implemented",
      requestId: request.requestId,
      message:
        "Root Cause Investigation will be implemented in a later sprint.",
    };
  }
}
