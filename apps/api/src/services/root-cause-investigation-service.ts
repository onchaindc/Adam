import type {
  AnalysisMode,
  RootCauseInvestigationResponse,
  ServiceRequest,
} from "@adam/contracts";

import type { AiIntelligenceEngine } from "../intelligence/ai/ai-intelligence-engine.js";
import type { RepositoryModel } from "../investigation/repository/model.js";
import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { RootCauseEngine } from "../investigation/root-cause/root-cause-engine.js";
import type { InvestigationLogInput } from "../investigation/root-cause/types.js";
import type { SharedExecutionContext } from "../planner/shared-execution-context.js";
import type { GitHubRepositoryAcquirer } from "../platform/github/github-repository.js";
import { buildInvestigationResponse } from "../reporting/root-cause/investigation-report-builder.js";
import { EvidenceLinkResolver } from "../traceability/evidence-link-resolver.js";
import { EvidenceTraceabilityEngine } from "../traceability/evidence-traceability-engine.js";
import type { UntracedRootCauseInvestigationResponse } from "../traceability/types.js";
import type { AdamService } from "./adam-service.js";
import { requireAiIntelligence } from "./analysis-mode.js";
import { withRepositoryModel } from "./repository-model-execution.js";

interface RootCauseInvestigationInput {
  readonly repositoryUrl: string;
  readonly logs: readonly InvestigationLogInput[];
  readonly analysisMode?: AnalysisMode;
}

export class RootCauseInvestigationService implements AdamService {
  public readonly service = "root-cause-investigation" as const;

  public constructor(
    private readonly acquirer: GitHubRepositoryAcquirer,
    private readonly scanner: RepositoryScanner,
    private readonly engine: RootCauseEngine,
    private readonly traceability = new EvidenceTraceabilityEngine(
      new EvidenceLinkResolver(),
    ),
    private readonly aiIntelligence: AiIntelligenceEngine | null = null,
  ) {}

  public async execute(
    request: ServiceRequest,
  ): Promise<RootCauseInvestigationResponse> {
    const input = request.input as RootCauseInvestigationInput;
    const analysisMode = input.analysisMode ?? "deterministic";
    return withRepositoryModel(
      this.acquirer,
      this.scanner,
      input.repositoryUrl,
      async (model) => {
        const response = this.traceability.enrichRootCause(
          this.investigateModel(request.requestId, model, input.logs),
          analysisMode,
        );
        return analysisMode === "intelligent"
          ? requireAiIntelligence(
              this.aiIntelligence,
            ).enhanceRootCause(response)
          : response;
      },
    );
  }

  public async executeInContext(
    context: SharedExecutionContext,
  ): Promise<void> {
    context.recordResult(
      this.traceability.enrichRootCause(
        this.investigateModel(
          context.requestId,
          context.model,
          context.logs,
        ),
        "deterministic",
      ),
    );
  }

  private investigateModel(
    requestId: string,
    model: RepositoryModel,
    logs: readonly InvestigationLogInput[],
  ): UntracedRootCauseInvestigationResponse {
    const result = this.engine.investigate(model, logs);

    return buildInvestigationResponse({
      requestId,
      model,
      candidate: result.candidate,
      entries: result.entries,
      limitations: result.limitations,
    });
  }
}
