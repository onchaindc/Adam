import type { Router } from "express";
import { Router as createRouter } from "express";
import { z } from "zod";

import type { Environment } from "../../config/environment.js";
import type { RuntimeState } from "../../platform/state/runtime-state.js";
import { planRequest } from "../../planner/planner.js";
import type { ServiceDispatcher } from "../../services/service-dispatcher.js";

const repositoryRequestSchema = z
  .object({
    repositoryUrl: z.string().min(1),
  })
  .strict();

export interface RouteDependencies {
  readonly dispatcher: ServiceDispatcher;
  readonly environment: Environment;
  readonly runtimeState: RuntimeState;
}

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = createRouter();
  const investigationRequestSchema = createInvestigationRequestSchema(
    dependencies.environment,
  );

  router.get("/", (request, response) => {
    response.json({
      name: "Adam",
      role: "OKX A2MCP Agent Service Provider",
      version: "0.5.0",
      status: "root-cause-investigation-ready",
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
    const parsed = repositoryRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "invalid-request",
        requestId: request.requestId,
        message: "Body must contain only a non-empty repositoryUrl string.",
      });
      return;
    }

    const decision = planRequest({ requestedService: "security-audit" });
    const result = await dependencies.dispatcher.dispatch(decision.service, {
      requestId: request.requestId,
      input: parsed.data,
    });
    response.status(200).json(result);
  });

  router.post("/repository/summary", async (request, response) => {
    const parsed = repositoryRequestSchema.safeParse(request.body);
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
    const parsed = investigationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "invalid-request",
        requestId: request.requestId,
        message:
          "Body must contain a repositoryUrl and bounded logs with source and content.",
      });
      return;
    }

    const decision = planRequest({
      requestedService: "root-cause-investigation",
    });
    const result = await dependencies.dispatcher.dispatch(decision.service, {
      requestId: request.requestId,
      input: parsed.data,
    });
    response.status(200).json(result);
  });

  return router;
}

function createInvestigationRequestSchema(environment: Environment) {
  const logSchema = z
    .object({
      source: z.enum([
        "build",
        "runtime",
        "ci",
        "stack-trace",
        "error-message",
      ]),
      label: z.string().trim().min(1).max(100).optional(),
      content: z.string().min(1).max(environment.INVESTIGATION_MAX_LOG_BYTES),
    })
    .strict();

  return z
    .object({
      repositoryUrl: z.string().min(1),
      logs: z
        .array(logSchema)
        .min(1)
        .max(environment.INVESTIGATION_MAX_LOG_INPUTS),
    })
    .strict()
    .superRefine((input, context) => {
      const totalBytes = input.logs.reduce(
        (total, log) => total + Buffer.byteLength(log.content, "utf8"),
        0,
      );
      if (totalBytes > environment.INVESTIGATION_MAX_LOG_BYTES) {
        context.addIssue({
          code: "custom",
          message: "Combined log content exceeds the configured byte limit.",
          path: ["logs"],
        });
      }
    });
}
