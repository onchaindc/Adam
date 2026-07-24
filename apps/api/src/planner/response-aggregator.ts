import type {
  PlannerExecutionPlan,
  PlannerIntentClassification,
  PlannerUnifiedResponse,
  RepositoryIntelligenceResponse,
  RootCauseInvestigationResponse,
  SecurityAuditResponse,
} from "@adam/contracts";

import type { SharedExecutionContext } from "./shared-execution-context.js";

export class ResponseAggregator {
  public aggregate(input: {
    readonly context: SharedExecutionContext;
    readonly classification: PlannerIntentClassification;
    readonly plan: PlannerExecutionPlan;
  }): PlannerUnifiedResponse {
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
