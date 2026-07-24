import type {
  AnalysisMode,
  PlannerUnifiedResponse,
  RootCauseInvestigationResponse,
  SecurityAuditResponse,
} from "@adam/contracts";

import type { EvidenceLinkResolver } from "./evidence-link-resolver.js";
import type {
  UntracedPlannerUnifiedResponse,
  UntracedRootCauseInvestigationResponse,
  UntracedSecurityAuditResponse,
} from "./types.js";

export class EvidenceTraceabilityEngine {
  public constructor(private readonly resolver: EvidenceLinkResolver) {}

  public enrichSecurity(
    response: UntracedSecurityAuditResponse,
    analysisMode: AnalysisMode,
  ): SecurityAuditResponse {
    const resolution = this.resolver.resolveSecurity(response);

    return {
      ...response,
      analysisMode,
      recommendedFixOrder: resolution.recommendedFixOrder,
      recommendations: resolution.traceability.recommendations,
      traceability: resolution.traceability,
      aiIntelligence: null,
      report: {
        ...response.report,
        recommendedFixOrder: resolution.recommendedFixOrder,
      },
    };
  }

  public enrichRootCause(
    response: UntracedRootCauseInvestigationResponse,
    analysisMode: AnalysisMode,
  ): RootCauseInvestigationResponse {
    const resolution = this.resolver.resolveRootCause(response);
    const hasEvidence = resolution.traceability.evidence.length > 0;

    return {
      ...response,
      analysisMode,
      recommendedFixes: hasEvidence ? response.recommendedFixes : [],
      recommendations: resolution.traceability.recommendations,
      prevention: hasEvidence ? response.prevention : [],
      traceability: resolution.traceability,
      aiIntelligence: null,
    };
  }

  public enrichPlanner(
    response: UntracedPlannerUnifiedResponse,
    analysisMode: AnalysisMode,
  ): PlannerUnifiedResponse {
    const traces = [
      response.securityAssessment?.traceability,
      response.rootCauseInvestigation?.traceability,
      response.pullRequestReview?.traceability,
    ].filter((trace) => trace !== undefined);
    const traceability = this.resolver.merge(traces);

    return {
      ...response,
      analysisMode,
      recommendations: traceability.recommendations,
      traceability,
      aiIntelligence: null,
    };
  }
}
