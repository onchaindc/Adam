import type {
  AnalysisMode,
  PlannerUnifiedResponse,
  ServiceRequest,
} from "@adam/contracts";

import type { AiIntelligenceEngine } from "../intelligence/ai/ai-intelligence-engine.js";
import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { PlannerEngine } from "../planner/planner-engine.js";
import type { PlannerLogInput } from "../planner/types.js";
import type { GitHubRepositoryAcquirer } from "../platform/github/github-repository.js";
import { EvidenceLinkResolver } from "../traceability/evidence-link-resolver.js";
import { EvidenceTraceabilityEngine } from "../traceability/evidence-traceability-engine.js";
import type { AdamService } from "./adam-service.js";
import { requireAiIntelligence } from "./analysis-mode.js";
import { withRepositoryModel } from "./repository-model-execution.js";

interface PlannerServiceInput {
  readonly request: string;
  readonly repositoryUrl: string;
  readonly logs: readonly PlannerLogInput[];
  readonly analysisMode?: AnalysisMode;
}

export class PlannerService implements AdamService {
  public constructor(
    private readonly acquirer: GitHubRepositoryAcquirer,
    private readonly scanner: RepositoryScanner,
    private readonly engine: PlannerEngine,
    private readonly traceability = new EvidenceTraceabilityEngine(
      new EvidenceLinkResolver(),
    ),
    private readonly aiIntelligence: AiIntelligenceEngine | null = null,
  ) {}

  public async execute(
    request: ServiceRequest,
  ): Promise<PlannerUnifiedResponse> {
    const input = request.input as PlannerServiceInput;
    const analysisMode = input.analysisMode ?? "deterministic";

    return withRepositoryModel(
      this.acquirer,
      this.scanner,
      input.repositoryUrl,
      async (model) => {
        const deterministic = await this.engine.execute({
          requestId: request.requestId,
          request: input.request,
          repositoryUrl: input.repositoryUrl,
          logs: input.logs,
          model,
        });
        const response = this.traceability.enrichPlanner(
          deterministic,
          analysisMode,
        );
        return analysisMode === "intelligent"
          ? requireAiIntelligence(
              this.aiIntelligence,
            ).enhancePlanner(response)
          : response;
      },
    );
  }
}
