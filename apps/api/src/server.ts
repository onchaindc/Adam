import { createServer } from "node:http";

import { AuthenticationAuthorizationInspector } from "./analyzers/security/authentication-authorization-inspector.js";
import { ConfigurationInspector } from "./analyzers/security/configuration-inspector.js";
import { DependencyInspector } from "./analyzers/security/dependency-inspector.js";
import { SecretsScanner } from "./analyzers/security/secrets-scanner.js";
import { SecurityAuditEngine } from "./analyzers/security/security-audit-engine.js";
import { SmartContractInspector } from "./analyzers/security/smart-contract-inspector.js";
import { StaticSecurityPatternInspector } from "./analyzers/security/static-security-pattern-inspector.js";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/environment.js";
import { SecurityIntelligenceEngine } from "./intelligence/security/security-intelligence-engine.js";
import { RepositoryScanner } from "./investigation/repository/repository-scanner.js";
import { createLogger } from "./logging/logger.js";
import { GitHubRepositoryAcquirer } from "./platform/github/github-repository.js";
import { FileRuntimeStateStore } from "./platform/state/runtime-state.js";
import { RootCauseInvestigationPlaceholderService } from "./services/placeholder-services.js";
import { RepositoryIntelligenceService } from "./services/repository-intelligence-service.js";
import { SecurityAuditService } from "./services/security-audit-service.js";
import { DefaultServiceDispatcher } from "./services/service-dispatcher.js";

const environment = loadEnvironment();
const logger = createLogger(environment);
const stateStore = new FileRuntimeStateStore(environment.STATE_FILE);
const runtimeState = await stateStore.initialize();
const repositoryAcquirer = new GitHubRepositoryAcquirer({
  cloneTimeoutMs: environment.REPOSITORY_CLONE_TIMEOUT_MS,
});
const repositoryScanner = new RepositoryScanner({
  maxFiles: environment.REPOSITORY_MAX_FILES,
  maxDepth: environment.REPOSITORY_MAX_DEPTH,
  maxFileBytes: environment.REPOSITORY_MAX_FILE_BYTES,
  maxTotalSourceBytes: environment.REPOSITORY_MAX_TOTAL_SOURCE_BYTES,
});
const repositoryIntelligenceService = new RepositoryIntelligenceService(
  repositoryAcquirer,
  repositoryScanner,
);
const securityAuditService = new SecurityAuditService(
  repositoryAcquirer,
  repositoryScanner,
  new SecurityAuditEngine([
    new SecretsScanner(),
    new DependencyInspector(),
    new AuthenticationAuthorizationInspector(),
    new ConfigurationInspector(),
    new StaticSecurityPatternInspector(),
    new SmartContractInspector(),
  ]),
  new SecurityIntelligenceEngine(),
);
const dispatcher = new DefaultServiceDispatcher({
  "repository-intelligence": repositoryIntelligenceService,
  "security-audit": securityAuditService,
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
