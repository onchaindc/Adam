import type {
  AnalysisMode,
  PlannerUnifiedResponse,
  ServiceRequest,
} from "@adam/contracts";

import type { AiIntelligenceEngine } from "../intelligence/ai/ai-intelligence-engine.js";
import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { PlannerEngine } from "../planner/planner-engine.js";
import type { PlannerLogInput } from "../planner/types.js";
import { PlannerInputError } from "../planner/errors.js";
import type { GitHubRepositoryAcquirer } from "../platform/github/github-repository.js";
import { EvidenceLinkResolver } from "../traceability/evidence-link-resolver.js";
import { EvidenceTraceabilityEngine } from "../traceability/evidence-traceability-engine.js";
import type { AdamService } from "./adam-service.js";
import { requireAiIntelligence } from "./analysis-mode.js";
import { withRepositoryModel } from "./repository-model-execution.js";

interface PlannerServiceInput {
  readonly request: string;
  readonly repositoryUrl?: string;
  readonly pullRequest?: string;
  readonly owner?: string;
  readonly repo?: string;
  readonly pullNumber?: number;
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
    private readonly pullRequestReviewService: AdamService | null = null,
  ) {}

  public async execute(
    request: ServiceRequest,
  ): Promise<PlannerUnifiedResponse> {
    const input = request.input as PlannerServiceInput;
    const analysisMode = input.analysisMode ?? "deterministic";
    const preparation = this.engine.prepare(
      input.request,
      input.logs.length > 0,
    );

    if (preparation.classification.intent === "pull-request-review") {
      if (!this.pullRequestReviewService) {
        throw new Error("Pull Request Review service is not registered.");
      }
      const pullRequestInput =
        input.pullRequest !== undefined
          ? {
              pullRequest: input.pullRequest,
              analysisMode,
            }
          : input.owner !== undefined &&
              input.repo !== undefined &&
              input.pullNumber !== undefined
            ? {
                owner: input.owner,
                repo: input.repo,
                pullNumber: input.pullNumber,
                analysisMode,
              }
            : null;
      if (!pullRequestInput) {
        throw new PlannerInputError(
          "Pull Request Review requests require pullRequest URL or owner, repo, and pullNumber.",
        );
      }

      const startedAt = new Date();
      const startedAtMs = Date.now();
      const review = await this.pullRequestReviewService.execute({
        requestId: request.requestId,
        input: pullRequestInput,
      });
      if (review.service !== "pull-request-review") {
        throw new Error("Pull Request Review returned an unexpected result.");
      }
      return this.traceability.enrichPlanner(
        this.engine.aggregatePullRequest({
          requestId: request.requestId,
          request: input.request,
          classification: preparation.classification,
          plan: preparation.plan,
          review,
          startedAt,
          startedAtMs,
        }),
        analysisMode,
      );
    }

    if (!input.repositoryUrl) {
      throw new PlannerInputError(
        "Repository-based planner requests require repositoryUrl.",
      );
    }
    const repositoryUrl = input.repositoryUrl;

    return withRepositoryModel(
      this.acquirer,
      this.scanner,
      repositoryUrl,
      async (model) => {
        const deterministic = await this.engine.execute(
          {
            requestId: request.requestId,
            request: input.request,
            repositoryUrl,
            logs: input.logs,
            model,
          },
          preparation,
        );
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
