import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";

import { RepositoryIntelligenceError } from "../../investigation/repository/errors.js";

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

    response.status(500).json({
      error: "internal-error",
      requestId: request.requestId,
    });
  };
}
