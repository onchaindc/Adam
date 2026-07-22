import { createServer } from "node:http";

import { createApp } from "./app.js";
import { loadEnvironment } from "./config/environment.js";
import { createLogger } from "./logging/logger.js";
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
const dispatcher = new DefaultServiceDispatcher({
  "security-audit": new SecurityAuditPlaceholderService(),
  "root-cause-investigation": new RootCauseInvestigationPlaceholderService(),
});
const app = createApp({
  dispatcher,
  environment,
  logger,
  runtimeState,
});
const server = createServer(app);

await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(environment.PORT, environment.HOST, resolve);
});

logger.info(
  {
    host: environment.HOST,
    port: environment.PORT,
    instanceId: runtimeState.instanceId,
    bootCount: runtimeState.bootCount,
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
