import type { Router } from "express";
import { Router as createRouter } from "express";

import type { RuntimeState } from "../../platform/state/runtime-state.js";
import { planRequest } from "../../planner/planner.js";
import type { PaymentRuntime } from "../../payments/x402/runtime.js";
import type { ServiceDispatcher } from "../../services/service-dispatcher.js";

export interface RouteDependencies {
  readonly dispatcher: ServiceDispatcher;
  readonly paymentRuntime: PaymentRuntime;
  readonly runtimeState: RuntimeState;
}

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = createRouter();

  router.get("/", (request, response) => {
    response.json({
      name: "Adam",
      role: "OKX A2MCP Agent Service Provider",
      version: "0.1.0",
      status: "foundation-ready",
      requestId: request.requestId,
    });
  });

  router.get("/health", (request, response) => {
    response.json({
      status: "ok",
      requestId: request.requestId,
      runtime: {
        instanceId: dependencies.runtimeState.instanceId,
        bootCount: dependencies.runtimeState.bootCount,
      },
      payments: {
        enabled: dependencies.paymentRuntime.enabled,
        ready: dependencies.paymentRuntime.isReady(),
      },
    });
  });

  router.post("/audit", async (request, response) => {
    const decision = planRequest({ requestedService: "security-audit" });
    const result = await dependencies.dispatcher.dispatch(decision.service, {
      requestId: request.requestId,
      input: request.body,
    });
    response.status(501).json(result);
  });

  router.post("/investigate", async (request, response) => {
    const decision = planRequest({
      requestedService: "root-cause-investigation",
    });
    const result = await dependencies.dispatcher.dispatch(decision.service, {
      requestId: request.requestId,
      input: request.body,
    });
    response.status(501).json(result);
  });

  return router;
}
