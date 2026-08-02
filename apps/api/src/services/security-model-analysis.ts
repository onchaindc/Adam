import type {
  AnalysisMode,
  SecurityProfile,
  SecurityAuditResponse,
} from "@adam/contracts";

import type { SecurityAuditEngine } from "../analyzers/security/security-audit-engine.js";
import type { SecurityIntelligenceEngine } from "../intelligence/security/security-intelligence-engine.js";
import type { RepositoryModel } from "../investigation/repository/model.js";
import type { EvidenceTraceabilityEngine } from "../traceability/evidence-traceability-engine.js";
import {
  staticSecurityEnrichment,
  type SecurityEnrichmentResult,
} from "./security-enrichment-engine.js";
import { buildSecurityAuditCoverage } from "./security-audit-coverage.js";

export function analyzeSecurityModel(input: {
  readonly requestId: string;
  readonly model: RepositoryModel;
  readonly analysisMode: AnalysisMode;
  readonly securityProfile?: SecurityProfile;
  readonly enrichment?: SecurityEnrichmentResult;
  readonly engine: SecurityAuditEngine;
  readonly intelligence: SecurityIntelligenceEngine;
  readonly traceability: EvidenceTraceabilityEngine;
}): SecurityAuditResponse {
  const securityProfile = input.securityProfile ?? "static";
  const enrichment = input.enrichment ?? staticSecurityEnrichment();
  const result = input.engine.analyze(input.model, {
    additionalFindings: enrichment.findings,
    additionalLimitations: enrichment.limitations,
    liveVulnerabilityAnalysis:
      enrichment.summary.liveVulnerabilities.status !== "not-requested",
  });
  const intelligence = input.intelligence.analyze({
    repositorySummary: input.model.summary,
    modulesExecuted: result.modulesExecuted,
    filesAnalyzed: result.filesAnalyzed,
    findings: result.findings,
      limitations: result.limitations,
    });

  return input.traceability.enrichSecurity(
    {
      service: "security-audit",
      status: "completed",
      requestId: input.requestId,
      securityProfile,
      repository: input.model.identity,
      modulesExecuted: result.modulesExecuted,
      filesAnalyzed: result.filesAnalyzed,
      findings: intelligence.findings,
      securityScore: intelligence.securityScore,
      overallRiskRating: intelligence.overallRiskRating,
      recommendedFixOrder: intelligence.recommendedFixOrder,
      report: intelligence.report,
      limitations: intelligence.report.limitations,
      enrichment: enrichment.summary,
      coverage: buildSecurityAuditCoverage({
        model: input.model,
        profile: securityProfile,
        modulesExecuted: result.modulesExecuted,
        enrichment: enrichment.summary,
      }),
    },
    input.analysisMode,
  );
}
