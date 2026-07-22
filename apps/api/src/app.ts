import express, { type Express, type Request } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

import type { Environment } from "./config/environment.js";
import type { RuntimeState } from "./platform/state/runtime-state.js";
import type { ServiceDispatcher } from "./services/service-dispatcher.js";
import { createErrorHandler } from "./transport/http/error-handler.js";
import { requestContext } from "./transport/http/request-context.js";
import { createRoutes } from "./transport/http/routes.js";

export interface AppDependencies {
  readonly dispatcher: ServiceDispatcher;
  readonly environment: Environment;
  readonly logger: Logger;
  readonly runtimeState: RuntimeState;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger: dependencies.logger,
      genReqId: (request: Request) => request.requestId,
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.use(createRoutes(dependencies));
  app.use(createErrorHandler(dependencies.logger));

  return app;
}
