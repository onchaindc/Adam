import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";

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

    response.status(500).json({
      error: "internal-error",
      requestId: request.requestId,
    });
  };
}
