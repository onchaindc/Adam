import type { SecurityAuditResponse, ServiceRequest } from "@adam/contracts";

import type { SecurityAuditEngine } from "../analyzers/security/security-audit-engine.js";
import type { SecurityIntelligenceEngine } from "../intelligence/security/security-intelligence-engine.js";
import type { RepositoryModel } from "../investigation/repository/model.js";
import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { SharedExecutionContext } from "../planner/shared-execution-context.js";
import type { GitHubRepositoryAcquirer } from "../platform/github/github-repository.js";
import type { AdamService } from "./adam-service.js";
import { withRepositoryModel } from "./repository-model-execution.js";

interface SecurityAuditInput {
  readonly repositoryUrl: string;
}

export class SecurityAuditService implements AdamService {
  public readonly service = "security-audit" as const;

  public constructor(
    private readonly acquirer: GitHubRepositoryAcquirer,
    private readonly scanner: RepositoryScanner,
    private readonly engine: SecurityAuditEngine,
    private readonly intelligence: SecurityIntelligenceEngine,
  ) {}

  public async execute(request: ServiceRequest): Promise<SecurityAuditResponse> {
    const input = request.input as SecurityAuditInput;
    return withRepositoryModel(
      this.acquirer,
      this.scanner,
      input.repositoryUrl,
      (model) => this.analyzeModel(request.requestId, model),
    );
  }

  public async executeInContext(
    context: SharedExecutionContext,
  ): Promise<void> {
    context.recordResult(
      this.analyzeModel(context.requestId, context.model),
    );
  }

  private analyzeModel(
    requestId: string,
    model: RepositoryModel,
  ): SecurityAuditResponse {
    const result = this.engine.analyze(model);
    const intelligence = this.intelligence.analyze({
      repositorySummary: model.summary,
      modulesExecuted: result.modulesExecuted,
      filesAnalyzed: result.filesAnalyzed,
      findings: result.findings,
      limitations: result.limitations,
    });

    return {
      service: this.service,
      status: "completed",
      requestId,
      repository: model.identity,
      modulesExecuted: result.modulesExecuted,
      filesAnalyzed: result.filesAnalyzed,
      findings: intelligence.findings,
      securityScore: intelligence.securityScore,
      overallRiskRating: intelligence.overallRiskRating,
      recommendedFixOrder: intelligence.recommendedFixOrder,
      report: intelligence.report,
      limitations: intelligence.report.limitations,
    };
  }
}
