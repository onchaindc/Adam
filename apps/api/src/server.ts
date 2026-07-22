import { createServer } from "node:http";

import { createApp } from "./app.js";
import { loadEnvironment } from "./config/environment.js";
import { createLogger } from "./logging/logger.js";
import { createPaymentRuntime } from "./payments/x402/runtime.js";
import { FileRuntimeStateStore } from "./platform/state/runtime-state.js";
import {
  RootCauseInvestigationPlaceholderService,
  SecurityAuditPlaceholderService,
} from "./services/placeholder-services.js";
import { DefaultServiceDispatcher } from "./services/service-dispatcher.js";

const environment = loadEnvironment();
const logger = createLogger(environment);
const stateStore = new FileRuntimeStateStore(environment.STATE_FILE);
const runtimeState = await stateStore.initialize();
const paymentRuntime = createPaymentRuntime(environment, logger);
const dispatcher = new DefaultServiceDispatcher({
  "security-audit": new SecurityAuditPlaceholderService(),
  "root-cause-investigation": new RootCauseInvestigationPlaceholderService(),
});
const app = createApp({
  dispatcher,
  environment,
  logger,
  paymentRuntime,
  runtimeState,
});
const server = createServer(app);

await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(environment.PORT, environment.HOST, resolve);
});

try {
  await paymentRuntime.initialize();
} catch (error) {
  logger.fatal({ error }, "Failed to initialize OKX x402 seller runtime");
  server.close();
  process.exitCode = 1;
  throw error;
}

logger.info(
  {
    host: environment.HOST,
    port: environment.PORT,
    instanceId: runtimeState.instanceId,
    bootCount: runtimeState.bootCount,
    paymentsEnabled: paymentRuntime.enabled,
  },
  "Adam API started",
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "Shutdown requested");
    server.close((error) => {
      if (error) {
        logger.error({ error }, "HTTP server shutdown failed");
        process.exitCode = 1;
      }
    });
  });
}
