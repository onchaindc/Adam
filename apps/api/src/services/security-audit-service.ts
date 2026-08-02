import type {
  AnalysisMode,
  SecurityProfile,
  SecurityAuditResponse,
  ServiceRequest,
} from "@adam/contracts";

import type { SecurityAuditEngine } from "../analyzers/security/security-audit-engine.js";
import type { AiIntelligenceEngine } from "../intelligence/ai/ai-intelligence-engine.js";
import type { SecurityIntelligenceEngine } from "../intelligence/security/security-intelligence-engine.js";
import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { SharedExecutionContext } from "../planner/shared-execution-context.js";
import type { GitHubRepositoryAcquirer } from "../platform/github/github-repository.js";
import { EvidenceLinkResolver } from "../traceability/evidence-link-resolver.js";
import { EvidenceTraceabilityEngine } from "../traceability/evidence-traceability-engine.js";
import type { AdamService } from "./adam-service.js";
import { requireAiIntelligence } from "./analysis-mode.js";
import { withRepositoryModel } from "./repository-model-execution.js";
import { analyzeSecurityModel } from "./security-model-analysis.js";
import type { SecurityEnrichmentEngine } from "./security-enrichment-engine.js";
import {
  NoopSecurityEnrichmentEngine,
  staticSecurityEnrichment,
} from "./security-enrichment-engine.js";

interface SecurityAuditInput {
  readonly repositoryUrl: string;
  readonly analysisMode?: AnalysisMode;
  readonly securityProfile?: SecurityProfile;
}

export class SecurityAuditService implements AdamService {
  public readonly service = "security-audit" as const;

  public constructor(
    private readonly acquirer: GitHubRepositoryAcquirer,
    private readonly scanner: RepositoryScanner,
    private readonly engine: SecurityAuditEngine,
    private readonly intelligence: SecurityIntelligenceEngine,
    private readonly traceability = new EvidenceTraceabilityEngine(
      new EvidenceLinkResolver(),
    ),
    private readonly aiIntelligence: AiIntelligenceEngine | null = null,
    private readonly enrichment: Pick<SecurityEnrichmentEngine, "analyze"> =
      new NoopSecurityEnrichmentEngine(),
    private readonly historyDepth = 1,
  ) {}

  public async execute(request: ServiceRequest): Promise<SecurityAuditResponse> {
    const input = request.input as SecurityAuditInput;
    const analysisMode = input.analysisMode ?? "deterministic";
    const securityProfile = input.securityProfile ?? "static";
    return withRepositoryModel(
      this.acquirer,
      this.scanner,
      input.repositoryUrl,
      async (model) => {
        const enrichment = await this.enrichment.analyze(model, securityProfile);
        const response = analyzeSecurityModel({
          requestId: request.requestId,
          model,
          analysisMode,
          securityProfile,
          enrichment,
          engine: this.engine,
          intelligence: this.intelligence,
          traceability: this.traceability,
        });
        return analysisMode === "intelligent"
          ? requireAiIntelligence(
              this.aiIntelligence,
            ).enhanceSecurity(response)
          : response;
      },
      {
        cloneDepth: securityProfile === "static" ? 1 : this.historyDepth,
      },
    );
  }

  public async executeInContext(
    context: SharedExecutionContext,
  ): Promise<void> {
    context.recordResult(
      analyzeSecurityModel({
        requestId: context.requestId,
        model: context.model,
        analysisMode: "deterministic",
        securityProfile: "static",
        enrichment: staticSecurityEnrichment(),
        engine: this.engine,
        intelligence: this.intelligence,
        traceability: this.traceability,
      }),
    );
  }
}
