import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";

import { AiIntelligenceError } from "../../intelligence/ai/errors.js";
import { PullRequestReviewError } from "../../investigation/pull-request/errors.js";
import { RepositoryIntelligenceError } from "../../investigation/repository/errors.js";
import { PlannerInputError } from "../../planner/errors.js";

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, request, response, _next) => {
    logger.error(
      {
        error,
        requestId: request.requestId,
        method: request.method,
        path: request.path,
      },
      "Unhandled request error",
    );

    if (error instanceof RepositoryIntelligenceError) {
      const status =
        error.code === "invalid-repository-url"
          ? 400
          : error.code === "repository-limit-exceeded"
            ? 422
            : 502;
      response.status(status).json({
        error: error.code,
        requestId: request.requestId,
        message: error.message,
      });
      return;
    }

    if (error instanceof PlannerInputError) {
      response.status(400).json({
        error: error.code,
        requestId: request.requestId,
        message: error.message,
      });
      return;
    }

    if (error instanceof PullRequestReviewError) {
      const status =
        error.code === "invalid-pull-request-reference"
          ? 400
          : error.code === "pull-request-not-found"
            ? 404
            : error.code === "pull-request-limit-exceeded"
              ? 422
              : error.code === "github-rate-limited"
                ? 503
                : 502;
      response.status(status).json({
        error: error.code,
        requestId: request.requestId,
        message: error.message,
      });
      return;
    }

    if (error instanceof AiIntelligenceError) {
      const status = error.code === "ai-not-configured" ? 503 : 502;
      response.status(status).json({
        error: error.code,
        requestId: request.requestId,
        message: error.message,
      });
      return;
    }

    response.status(500).json({
      error: "internal-error",
      requestId: request.requestId,
    });
  };
}
