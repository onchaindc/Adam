import pino, { type Logger } from "pino";

import type { Environment } from "../config/environment.js";

export function createLogger(environment: Environment): Logger {
  return pino({
    level: environment.LOG_LEVEL,
    base: {
      service: "adam-api",
      environment: environment.NODE_ENV,
    },
    redact: {
      paths: ["req.headers.authorization"],
      censor: "[REDACTED]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
