import type { SecurityAuditResponse, ServiceRequest } from "@adam/contracts";

import type { SecurityAuditEngine } from "../analyzers/security/security-audit-engine.js";
import type { SecurityIntelligenceEngine } from "../intelligence/security/security-intelligence-engine.js";
import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { GitHubRepositoryAcquirer } from "../platform/github/github-repository.js";
import type { AdamService } from "./placeholder-services.js";

interface SecurityAuditInput {
  readonly repositoryUrl: string;
}

export class SecurityAuditService implements AdamService {
  public constructor(
    private readonly acquirer: GitHubRepositoryAcquirer,
    private readonly scanner: RepositoryScanner,
    private readonly engine: SecurityAuditEngine,
    private readonly intelligence: SecurityIntelligenceEngine,
  ) {}

  public async execute(request: ServiceRequest): Promise<SecurityAuditResponse> {
    const input = request.input as SecurityAuditInput;
    const acquired = await this.acquirer.acquire(input.repositoryUrl);

    try {
      const model = await this.scanner.scan(acquired.directory, {
        name: acquired.reference.name,
        owner: acquired.reference.owner,
        url: acquired.reference.canonicalUrl.replace(/\.git$/, ""),
        defaultBranch: acquired.defaultBranch,
        commitSha: acquired.commitSha,
      });
      const result = this.engine.analyze(model);
      const intelligence = this.intelligence.analyze({
        repositorySummary: model.summary,
        modulesExecuted: result.modulesExecuted,
        filesAnalyzed: result.filesAnalyzed,
        findings: result.findings,
        limitations: result.limitations,
      });

      return {
        service: "security-audit",
        status: "completed",
        requestId: request.requestId,
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
    } finally {
      await acquired.cleanup();
    }
  }
}
