import type {
  AiIntelligenceReport,
  AnalysisMode,
  PullRequestAiReview,
  PullRequestReviewResponse,
  ServiceRequest,
} from "@adam/contracts";

import type { SecurityAuditEngine } from "../analyzers/security/security-audit-engine.js";
import { AiIntelligenceError } from "../intelligence/ai/errors.js";
import type { AiIntelligenceEngine } from "../intelligence/ai/ai-intelligence-engine.js";
import type { SecurityIntelligenceEngine } from "../intelligence/security/security-intelligence-engine.js";
import type { PullRequestFetcher } from "../investigation/pull-request/pull-request-fetcher.js";
import type { PullRequestInput } from "../investigation/pull-request/types.js";
import type { RepositoryModel } from "../investigation/repository/model.js";
import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { EvidenceTraceabilityEngine } from "../traceability/evidence-traceability-engine.js";
import type { AdamService } from "./adam-service.js";
import { analyzeSecurityModel } from "./security-model-analysis.js";

interface PullRequestReviewInput extends PullRequestInput {
  readonly analysisMode?: AnalysisMode;
}

export class PullRequestReviewService implements AdamService {
  public readonly service = "pull-request-review" as const;

  public constructor(
    private readonly fetcher: PullRequestFetcher,
    private readonly scanner: RepositoryScanner,
    private readonly engine: SecurityAuditEngine,
    private readonly intelligence: SecurityIntelligenceEngine,
    private readonly traceability: EvidenceTraceabilityEngine,
    private readonly aiIntelligence: AiIntelligenceEngine | null,
  ) {}

  public async execute(
    request: ServiceRequest,
  ): Promise<PullRequestReviewResponse> {
    const input = request.input as PullRequestReviewInput;
    const analysisMode = input.analysisMode ?? "deterministic";
    const acquired = await this.fetcher.fetch(input);

    try {
      const scannedModel = await this.scanner.scan(
        acquired.directory,
        acquired.identity,
      );
      const model = includeAcquisitionLimitations(
        scannedModel,
        acquired.limitations,
      );
      const security = analyzeSecurityModel({
        requestId: request.requestId,
        model,
        analysisMode,
        engine: this.engine,
        intelligence: this.intelligence,
        traceability: this.traceability,
      });
      const reviewLimitations = [...security.limitations];
      let aiReview: PullRequestAiReview | null = null;

      if (analysisMode === "intelligent" && this.aiIntelligence) {
        try {
          const enhanced =
            await this.aiIntelligence.enhanceSecurity(security);
          if (enhanced.aiIntelligence) {
            aiReview = mapAiReview(enhanced.aiIntelligence);
          }
        } catch (error) {
          if (!(error instanceof AiIntelligenceError)) {
            throw error;
          }
          reviewLimitations.push(
            `AI review was unavailable (${error.code}); deterministic PR review completed successfully.`,
          );
        }
      } else if (analysisMode === "intelligent") {
        reviewLimitations.push(
          "AI review was not configured; deterministic PR review completed successfully.",
        );
      }

      return {
        service: this.service,
        status: "completed",
        requestId: request.requestId,
        analysisMode,
        pullRequest: acquired.metadata,
        summary: {
          filesChanged: acquired.metadata.changedFileCount,
          filesAnalyzed: security.filesAnalyzed,
          filesWithPatches: acquired.changedFiles.filter(
            (file) => file.patch !== null,
          ).length,
          filesWithoutContent: acquired.changedFiles.filter(
            (file) => !file.contentAvailable,
          ).length,
          additions: acquired.metadata.additions,
          deletions: acquired.metadata.deletions,
          limitations: reviewLimitations,
        },
        repositorySummary: model.summary,
        riskRating: security.overallRiskRating,
        securityScore: security.securityScore,
        changedFiles: acquired.changedFiles,
        findings: security.findings,
        recommendations: security.recommendations,
        traceability: security.traceability,
        aiReview,
      };
    } finally {
      await acquired.cleanup();
    }
  }
}

function includeAcquisitionLimitations(
  model: RepositoryModel,
  limitations: readonly string[],
): RepositoryModel {
  const combined = [...limitations, ...model.analysisLimitations];
  return {
    ...model,
    analysisLimitations: combined,
    summary: {
      ...model.summary,
      limitations: combined,
    },
  };
}

function mapAiReview(
  report: AiIntelligenceReport,
): PullRequestAiReview {
  return {
    status: report.status,
    provider: report.provider,
    model: report.model,
    cacheHit: report.cacheHit,
    securityObservations: report.executiveSummary,
    possibleBugs: report.attackNarrative,
    maintainabilityConcerns: report.architectureObservations,
    breakingChangeRisks: report.businessImpact,
    codeQualityComments: report.developerSummary,
    remediationStrategy: report.remediationStrategy,
    priorityRoadmap: report.priorityRoadmap,
    confidenceSummary: report.confidenceSummary,
    limitations: report.limitations,
  };
}
