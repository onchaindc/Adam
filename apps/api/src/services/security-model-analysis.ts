import type {
  AnalysisMode,
  SecurityAuditResponse,
} from "@adam/contracts";

import type { SecurityAuditEngine } from "../analyzers/security/security-audit-engine.js";
import type { SecurityIntelligenceEngine } from "../intelligence/security/security-intelligence-engine.js";
import type { RepositoryModel } from "../investigation/repository/model.js";
import type { EvidenceTraceabilityEngine } from "../traceability/evidence-traceability-engine.js";

export function analyzeSecurityModel(input: {
  readonly requestId: string;
  readonly model: RepositoryModel;
  readonly analysisMode: AnalysisMode;
  readonly engine: SecurityAuditEngine;
  readonly intelligence: SecurityIntelligenceEngine;
  readonly traceability: EvidenceTraceabilityEngine;
}): SecurityAuditResponse {
  const result = input.engine.analyze(input.model);
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
      repository: input.model.identity,
      modulesExecuted: result.modulesExecuted,
      filesAnalyzed: result.filesAnalyzed,
      findings: intelligence.findings,
      securityScore: intelligence.securityScore,
      overallRiskRating: intelligence.overallRiskRating,
      recommendedFixOrder: intelligence.recommendedFixOrder,
      report: intelligence.report,
      limitations: intelligence.report.limitations,
    },
    input.analysisMode,
  );
}
