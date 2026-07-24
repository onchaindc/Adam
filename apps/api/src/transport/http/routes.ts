import type { Router } from "express";
import { Router as createRouter } from "express";
import { z } from "zod";

import type { Environment } from "../../config/environment.js";
import type { RuntimeState } from "../../platform/state/runtime-state.js";
import { planRequest } from "../../planner/planner.js";
import type { AdamService } from "../../services/adam-service.js";
import type { ServiceDispatcher } from "../../services/service-dispatcher.js";

const repositoryRequestSchema = z
  .object({
    repositoryUrl: z.string().min(1),
  })
  .strict();
const analysisModeSchema = z
  .enum(["deterministic", "intelligent"])
  .default("deterministic");
const analysisRequestSchema = z
  .object({
    repositoryUrl: z.string().min(1),
    analysisMode: analysisModeSchema,
  })
  .strict();

export interface RouteDependencies {
  readonly dispatcher: ServiceDispatcher;
  readonly environment: Environment;
  readonly plannerService: AdamService;
  readonly runtimeState: RuntimeState;
}

export function createRoutes(dependencies: RouteDependencies): Router {
  const router = createRouter();
  const investigationRequestSchema = createInvestigationRequestSchema(
    dependencies.environment,
  );
  const plannerRequestSchema = createPlannerRequestSchema(
    dependencies.environment,
  );

  router.get("/", (request, response) => {
    response.json({
      name: "Adam",
      role: "OKX A2MCP Agent Service Provider",
      version: "0.6.5",
      status: "evidence-intelligence-ready",
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
    const parsed = analysisRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "invalid-request",
        requestId: request.requestId,
        message:
          "Body must contain a repositoryUrl and optional analysisMode.",
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

  router.post("/plan", async (request, response) => {
    const parsed = plannerRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "invalid-request",
        requestId: request.requestId,
        message:
          "Body must contain a natural-language request, repositoryUrl, and optional bounded logs.",
      });
      return;
    }

    const result = await dependencies.plannerService.execute({
      requestId: request.requestId,
      input: parsed.data,
    });
    response.status(200).json(result);
  });

  return router;
}

function createInvestigationRequestSchema(environment: Environment) {
  const logSchema = createLogSchema(environment);

  return z
    .object({
      repositoryUrl: z.string().min(1),
      analysisMode: analysisModeSchema,
      logs: z
        .array(logSchema)
        .min(1)
        .max(environment.INVESTIGATION_MAX_LOG_INPUTS),
    })
    .strict()
    .superRefine((input, context) =>
      validateTotalLogBytes(
        input.logs,
        environment.INVESTIGATION_MAX_LOG_BYTES,
        context,
      ),
    );
}

function createPlannerRequestSchema(environment: Environment) {
  const logSchema = createLogSchema(environment);

  return z
    .object({
      request: z.string().trim().min(1).max(2_000),
      repositoryUrl: z.string().min(1),
      analysisMode: analysisModeSchema,
      logs: z
        .array(logSchema)
        .max(environment.INVESTIGATION_MAX_LOG_INPUTS)
        .default([]),
    })
    .strict()
    .superRefine((input, context) =>
      validateTotalLogBytes(
        input.logs,
        environment.INVESTIGATION_MAX_LOG_BYTES,
        context,
      ),
    );
}

function createLogSchema(environment: Environment) {
  return z
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
}

function validateTotalLogBytes(
  logs: readonly { readonly content: string }[],
  maximumBytes: number,
  context: z.core.$RefinementCtx,
): void {
  const totalBytes = logs.reduce(
    (total, log) => total + Buffer.byteLength(log.content, "utf8"),
    0,
  );
  if (totalBytes > maximumBytes) {
    context.addIssue({
      code: "custom",
      message: "Combined log content exceeds the configured byte limit.",
      path: ["logs"],
      input: logs,
    });
  }
}
