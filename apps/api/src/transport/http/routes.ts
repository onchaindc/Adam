import type { Router } from "express";
import { Router as createRouter } from "express";
import { z } from "zod";

import type { RuntimeState } from "../../platform/state/runtime-state.js";
import { planRequest } from "../../planner/planner.js";
import type { ServiceDispatcher } from "../../services/service-dispatcher.js";

const repositorySummaryRequestSchema = z
  .object({
    repositoryUrl: z.string().min(1),
  })
  .strict();

export interface RouteDependencies {
  readonly dispatcher: ServiceDispatcher;
  readonly runtimeState: RuntimeState;
}

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = createRouter();

  router.get("/", (request, response) => {
    response.json({
      name: "Adam",
      role: "OKX A2MCP Agent Service Provider",
      version: "0.2.0",
      status: "repository-intelligence-ready",
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

  router.post("/repository/summary", async (request, response) => {
    const parsed = repositorySummaryRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "invalid-request",
        requestId: request.requestId,
        message: "Body must contain only a non-empty repositoryUrl string.",
      });
      return;
    }

    const decision = planRequest({
      requestedService: "repository-intelligence",
    });
    const result = await dependencies.dispatcher.dispatch(decision.service, {
      requestId: request.requestId,
      input: parsed.data,
    });
    response.status(200).json(result);
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
