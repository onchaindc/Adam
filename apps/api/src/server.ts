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
import { AiIntelligenceEngine } from "./intelligence/ai/ai-intelligence-engine.js";
import { AiResultCache } from "./intelligence/ai/ai-result-cache.js";
import { PromptBuilder } from "./intelligence/ai/prompt-builder.js";
import { ReasoningFormatter } from "./intelligence/ai/reasoning-formatter.js";
import { SecurityIntelligenceEngine } from "./intelligence/security/security-intelligence-engine.js";
import { PullRequestFetcher } from "./investigation/pull-request/pull-request-fetcher.js";
import { RepositoryScanner } from "./investigation/repository/repository-scanner.js";
import { ConfigurationCauseDetector } from "./investigation/root-cause/detectors/configuration-cause-detector.js";
import { DependencyCauseDetector } from "./investigation/root-cause/detectors/dependency-cause-detector.js";
import { ExecutionCauseDetector } from "./investigation/root-cause/detectors/execution-cause-detector.js";
import { SmartContractCauseDetector } from "./investigation/root-cause/detectors/smart-contract-cause-detector.js";
import { LogNormalizer } from "./investigation/root-cause/log-normalizer.js";
import { RootCauseEngine } from "./investigation/root-cause/root-cause-engine.js";
import { createLogger } from "./logging/logger.js";
import { ExecutionPlanner } from "./planner/execution-planner.js";
import { DeterministicIntentClassifier } from "./planner/intent-classifier.js";
import { PlannerEngine } from "./planner/planner-engine.js";
import { ResponseAggregator } from "./planner/response-aggregator.js";
import { ServiceOrchestrator } from "./planner/service-orchestrator.js";
import { createAiReasoningProvider } from "./platform/ai/ai-provider-factory.js";
import { GitHubRepositoryAcquirer } from "./platform/github/github-repository.js";
import { FileRuntimeStateStore } from "./platform/state/runtime-state.js";
import { PlannerService } from "./services/planner-service.js";
import { PullRequestReviewService } from "./services/pull-request-review-service.js";
import { RepositoryIntelligenceService } from "./services/repository-intelligence-service.js";
import { RootCauseInvestigationService } from "./services/root-cause-investigation-service.js";
import { SecurityAuditService } from "./services/security-audit-service.js";
import { DefaultServiceDispatcher } from "./services/service-dispatcher.js";
import { EvidenceLinkResolver } from "./traceability/evidence-link-resolver.js";
import { EvidenceTraceabilityEngine } from "./traceability/evidence-traceability-engine.js";

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
const securityAuditEngine = new SecurityAuditEngine([
  new SecretsScanner(),
  new DependencyInspector(),
  new AuthenticationAuthorizationInspector(),
  new ConfigurationInspector(),
  new StaticSecurityPatternInspector(),
  new SmartContractInspector(),
]);
const securityIntelligence = new SecurityIntelligenceEngine();
const traceability = new EvidenceTraceabilityEngine(
  new EvidenceLinkResolver(),
);
const aiProvider = createAiReasoningProvider(environment);
const aiIntelligence = new AiIntelligenceEngine(
  aiProvider,
  new PromptBuilder(),
  new ReasoningFormatter(),
  new AiResultCache(
    environment.AI_CACHE_TTL_MS,
    environment.AI_CACHE_MAX_ENTRIES,
  ),
);
const repositoryIntelligenceService = new RepositoryIntelligenceService(
  repositoryAcquirer,
  repositoryScanner,
);
const securityAuditService = new SecurityAuditService(
  repositoryAcquirer,
  repositoryScanner,
  securityAuditEngine,
  securityIntelligence,
  traceability,
  aiIntelligence,
);
const pullRequestReviewService = new PullRequestReviewService(
  new PullRequestFetcher({
    ...(environment.GITHUB_TOKEN
      ? { token: environment.GITHUB_TOKEN }
      : {}),
    timeoutMs: environment.GITHUB_API_TIMEOUT_MS,
    maxFiles: environment.PULL_REQUEST_MAX_FILES,
    maxFileBytes: environment.REPOSITORY_MAX_FILE_BYTES,
    maxTotalSourceBytes: environment.REPOSITORY_MAX_TOTAL_SOURCE_BYTES,
    maxPatchBytes: environment.PULL_REQUEST_MAX_PATCH_BYTES,
  }),
  repositoryScanner,
  securityAuditEngine,
  securityIntelligence,
  traceability,
  aiProvider ? aiIntelligence : null,
);
const rootCauseInvestigationService = new RootCauseInvestigationService(
  repositoryAcquirer,
  repositoryScanner,
  new RootCauseEngine(
    new LogNormalizer(environment.INVESTIGATION_MAX_LOG_LINES),
    [
      new DependencyCauseDetector(),
      new ConfigurationCauseDetector(),
      new ExecutionCauseDetector(),
      new SmartContractCauseDetector(),
    ],
  ),
  traceability,
  aiIntelligence,
);
const plannerService = new PlannerService(
  repositoryAcquirer,
  repositoryScanner,
  new PlannerEngine(
    new DeterministicIntentClassifier(),
    new ExecutionPlanner(),
    new ServiceOrchestrator([
      repositoryIntelligenceService,
      securityAuditService,
      rootCauseInvestigationService,
    ]),
    new ResponseAggregator(),
  ),
  traceability,
  aiIntelligence,
  pullRequestReviewService,
);
const dispatcher = new DefaultServiceDispatcher({
  "repository-intelligence": repositoryIntelligenceService,
  "security-audit": securityAuditService,
  "root-cause-investigation": rootCauseInvestigationService,
  "pull-request-review": pullRequestReviewService,
});
const app = createApp({
  dispatcher,
  environment,
  logger,
  plannerService,
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
