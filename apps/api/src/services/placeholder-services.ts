import type { ServiceRequest, ServiceResponse } from "@adam/contracts";

export interface AdamService {
  execute(request: ServiceRequest): Promise<ServiceResponse>;
}
