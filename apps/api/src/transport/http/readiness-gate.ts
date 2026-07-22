import type { NextFunction, Request, Response } from "express";

import type { PaymentRuntime } from "../../payments/x402/runtime.js";

const PROTECTED_PATHS = new Set(["/audit", "/investigate"]);

export function createReadinessGate(
  paymentRuntime: PaymentRuntime,
): (request: Request, response: Response, next: NextFunction) => void {
  return (request, response, next) => {
    if (
      paymentRuntime.enabled &&
      PROTECTED_PATHS.has(request.path) &&
      !paymentRuntime.isReady()
    ) {
      response.status(503).json({
        error: "service-not-ready",
        requestId: request.requestId,
      });
      return;
    }

    next();
  };
}
