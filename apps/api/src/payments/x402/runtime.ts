import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import {
  paymentMiddlewareFromHTTPServer,
  x402HTTPResourceServer,
  x402ResourceServer,
} from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import type { RequestHandler } from "express";
import type { Logger } from "pino";

import type { Environment } from "../../config/environment.js";

const XLAYER_NETWORK = "eip155:196";

export interface PaymentRuntime {
  readonly enabled: boolean;
  readonly middleware: RequestHandler;
  initialize(): Promise<void>;
  isReady(): boolean;
}

export function createPaymentRuntime(
  environment: Environment,
  logger: Logger,
): PaymentRuntime {
  if (!environment.PAYMENTS_ENABLED) {
    return createDisabledPaymentRuntime();
  }

  const facilitatorClient = new OKXFacilitatorClient({
    apiKey: environment.OKX_API_KEY!,
    secretKey: environment.OKX_SECRET_KEY!,
    passphrase: environment.OKX_PASSPHRASE!,
    syncSettle: true,
  });

  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    XLAYER_NETWORK,
    new ExactEvmScheme(),
  );

  const httpServer = new x402HTTPResourceServer(resourceServer, {
    "POST /audit": {
      accepts: {
        scheme: "exact",
        network: XLAYER_NETWORK,
        payTo: environment.PAY_TO!,
        price: environment.AUDIT_PRICE_USD,
        maxTimeoutSeconds: 300,
      },
      description: "Adam Security Audit",
      mimeType: "application/json",
    },
    "POST /investigate": {
      accepts: {
        scheme: "exact",
        network: XLAYER_NETWORK,
        payTo: environment.PAY_TO!,
        price: environment.INVESTIGATE_PRICE_USD,
        maxTimeoutSeconds: 300,
      },
      description: "Adam Root Cause Investigation",
      mimeType: "application/json",
    },
  });

  let ready = false;

  return {
    enabled: true,
    middleware: paymentMiddlewareFromHTTPServer(httpServer),
    async initialize() {
      await resourceServer.initialize();
      ready = true;
      logger.info(
        { network: XLAYER_NETWORK },
        "OKX x402 seller runtime initialized",
      );
    },
    isReady() {
      return ready;
    },
  };
}

function createDisabledPaymentRuntime(): PaymentRuntime {
  return {
    enabled: false,
    middleware(_request, _response, next) {
      next();
    },
    async initialize() {},
    isReady() {
      return true;
    },
  };
}
