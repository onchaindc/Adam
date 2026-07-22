import type {
  ServiceRequest,
  ServiceResponse,
  ServiceKind,
} from "@adam/contracts";

import type { AdamService } from "./placeholder-services.js";

export interface ServiceDispatcher {
  dispatch(
    service: ServiceKind,
    request: ServiceRequest,
  ): Promise<ServiceResponse>;
}

export class DefaultServiceDispatcher implements ServiceDispatcher {
  public constructor(
    private readonly services: Readonly<Record<ServiceKind, AdamService>>,
  ) {}

  public dispatch(
    service: ServiceKind,
    request: ServiceRequest,
  ): Promise<ServiceResponse> {
    return this.services[service].execute(request);
  }
}
