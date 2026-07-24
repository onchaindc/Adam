import type {
  PlannerExecutionPlan,
  PlannerIntentClassification,
  PullRequestReviewResponse,
  RepositoryIntelligenceResponse,
  RootCauseInvestigationResponse,
  SecurityAuditResponse,
} from "@adam/contracts";

import type { SharedExecutionContext } from "./shared-execution-context.js";
import type { UntracedPlannerUnifiedResponse } from "../traceability/types.js";

export class ResponseAggregator {
  public aggregate(input: {
    readonly context: SharedExecutionContext;
    readonly classification: PlannerIntentClassification;
    readonly plan: PlannerExecutionPlan;
  }): UntracedPlannerUnifiedResponse {
    const repository = requireRepositoryResult(input.context);
    const security = getSecurityResult(input.context);
    const investigation = getInvestigationResult(input.context);
    const completedAt = new Date();

    return {
      service: "planner",
      status: "completed",
      requestId: input.context.requestId,
      requestSummary: {
        request: input.context.request,
        intent: input.classification.intent,
        confidence: input.classification.confidence,
      },
      plannerDecision: {
        classification: input.classification,
        executionPlan: input.plan,
        decisions: input.context.decisions,
      },
      servicesExecuted: input.context.timeline
        .filter((entry) => entry.status === "completed")
        .map((entry) => entry.service),
      repositoryOverview: repository.summary,
      securityAssessment: security,
      rootCauseInvestigation: investigation,
      pullRequestReview: null,
      overallRisk: security
        ? {
            rating: security.overallRiskRating,
            basis:
              "Overall risk is the approved deterministic Security Audit risk rating.",
          }
        : {
            rating: "not-assessed",
            basis:
              "Security Audit was not executed, so the planner does not infer a security risk rating.",
          },
      overallRecommendations: collectRecommendations(
        security,
        investigation,
      ),
      executionMetadata: {
        startedAt: input.context.startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs: Math.max(
          0,
          completedAt.getTime() - input.context.startedAtMs,
        ),
        timeline: input.context.timeline,
        sharedRepositoryModel: true,
        repositoryAcquisitions: 1,
      },
    };
  }

  public aggregatePullRequest(input: {
    readonly requestId: string;
    readonly request: string;
    readonly classification: PlannerIntentClassification;
    readonly plan: PlannerExecutionPlan;
    readonly review: PullRequestReviewResponse;
    readonly startedAt: Date;
    readonly startedAtMs: number;
  }): UntracedPlannerUnifiedResponse {
    const completedAt = new Date();
    const durationMs = Math.max(
      0,
      completedAt.getTime() - input.startedAtMs,
    );

    return {
      service: "planner",
      status: "completed",
      requestId: input.requestId,
      requestSummary: {
        request: input.request,
        intent: input.classification.intent,
        confidence: input.classification.confidence,
      },
      plannerDecision: {
        classification: input.classification,
        executionPlan: input.plan,
        decisions: [
          {
            stage: "intent-classification",
            decision: input.classification.intent,
            rationale: input.classification.rationale,
          },
          {
            stage: "execution-planning",
            decision: "pull-request-review",
            rationale:
              "Pull Request Review fetches and analyzes only the changed-file snapshot.",
          },
        ],
      },
      servicesExecuted: ["pull-request-review"],
      repositoryOverview: input.review.repositorySummary,
      securityAssessment: null,
      rootCauseInvestigation: null,
      pullRequestReview: input.review,
      overallRisk: {
        rating: input.review.riskRating,
        basis:
          "Overall risk is the existing deterministic Security Audit rating calculated over changed files only.",
      },
      overallRecommendations: input.review.recommendations.map(
        (recommendation) => recommendation.text,
      ),
      executionMetadata: {
        startedAt: input.startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs,
        timeline: [
          {
            service: "pull-request-review",
            status: "completed",
            startedAt: input.startedAt.toISOString(),
            completedAt: completedAt.toISOString(),
            durationMs,
          },
        ],
        sharedRepositoryModel: true,
        repositoryAcquisitions: 0,
      },
    };
  }
}

function requireRepositoryResult(
  context: SharedExecutionContext,
): RepositoryIntelligenceResponse {
  const result = context.getResult("repository-intelligence");
  if (!result || result.service !== "repository-intelligence") {
    throw new Error("Repository Intelligence did not produce a result.");
  }
  return result;
}

function getSecurityResult(
  context: SharedExecutionContext,
): SecurityAuditResponse | null {
  const result = context.getResult("security-audit");
  return result?.service === "security-audit" ? result : null;
}

function getInvestigationResult(
  context: SharedExecutionContext,
): RootCauseInvestigationResponse | null {
  const result = context.getResult("root-cause-investigation");
  return result?.service === "root-cause-investigation" ? result : null;
}

function collectRecommendations(
  security: SecurityAuditResponse | null,
  investigation: RootCauseInvestigationResponse | null,
): readonly string[] {
  const recommendations = [
    ...(security?.recommendedFixOrder.map(
      (fix) => `${fix.title}: ${fix.suggestedRemediation}`,
    ) ?? []),
    ...(investigation?.recommendedFixes ?? []),
  ];

  return [...new Set(recommendations)].slice(0, 20);
}
