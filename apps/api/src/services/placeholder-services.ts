import type {
  PlaceholderServiceResponse,
  ServiceRequest,
  ServiceResponse,
} from "@adam/contracts";

export interface AdamService {
  execute(request: ServiceRequest): Promise<ServiceResponse>;
}

export class SecurityAuditPlaceholderService implements AdamService {
  public async execute(
    request: ServiceRequest,
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
  implements AdamService
{
  public async execute(
    request: ServiceRequest,
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
