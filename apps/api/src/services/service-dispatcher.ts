import type {
  PlaceholderServiceRequest,
  PlaceholderServiceResponse,
  ServiceKind,
} from "@adam/contracts";

import type { PlaceholderService } from "./placeholder-services.js";

export interface ServiceDispatcher {
  dispatch(
    service: ServiceKind,
    request: PlaceholderServiceRequest,
  ): Promise<PlaceholderServiceResponse>;
}

export class DefaultServiceDispatcher implements ServiceDispatcher {
  public constructor(
    private readonly services: Readonly<Record<ServiceKind, PlaceholderService>>,
  ) {}

  public dispatch(
    service: ServiceKind,
    request: PlaceholderServiceRequest,
  ): Promise<PlaceholderServiceResponse> {
    return this.services[service].execute(request);
  }
}
