import type {
  IntelligentSecurityFinding,
  RepositorySummary,
  SecurityFinding,
  SecurityFindingCategory,
  SecurityReport,
  SecurityScore,
  SecurityScoreCategory,
  SecuritySeverity,
  RecommendedSecurityFix,
} from "@adam/contracts";

import { buildRecommendedFixOrder, buildSecurityReport } from "../../reporting/security/security-report-builder.js";
import { calculateSecurityScore } from "../../reporting/security/security-score.js";
import { buildFindingIntelligence } from "./rule-intelligence.js";

export interface SecurityIntelligenceResult {
  readonly findings: readonly IntelligentSecurityFinding[];
  readonly securityScore: SecurityScore;
  readonly overallRiskRating: SecuritySeverity;
  readonly recommendedFixOrder: readonly RecommendedSecurityFix[];
  readonly report: SecurityReport;
}

export class SecurityIntelligenceEngine {
  public analyze(input: {
    readonly repositorySummary: RepositorySummary;
    readonly modulesExecuted: readonly SecurityFindingCategory[];
    readonly filesAnalyzed: number;
    readonly findings: readonly SecurityFinding[];
    readonly limitations: readonly string[];
  }): SecurityIntelligenceResult {
    const findings = input.findings.map((finding) => ({
      ...finding,
      intelligence: buildFindingIntelligence(finding),
    }));
    const securityScore = calculateSecurityScore(
      findings,
      applicableScoreCategories(input.modulesExecuted),
    );
    const recommendedFixOrder = buildRecommendedFixOrder(findings);
    const limitations = [
      ...input.limitations,
      "Security intelligence is deterministic and rule-aware; it does not validate runtime reachability or exploitability.",
      "Likelihood reflects static evidence and detection confidence, not observed exploitation.",
    ];
    const report = buildSecurityReport({
      repositorySummary: input.repositorySummary,
      filesAnalyzed: input.filesAnalyzed,
      findings,
      securityScore,
      recommendedFixOrder,
      limitations,
    });

    return {
      findings,
      securityScore,
      overallRiskRating: securityScore.riskRating,
      recommendedFixOrder,
      report,
    };
  }
}

function applicableScoreCategories(
  modules: readonly SecurityFindingCategory[],
): readonly SecurityScoreCategory[] {
  const categories: SecurityScoreCategory[] = [];
  for (const module of modules) {
    if (module === "authentication-authorization") {
      categories.push("authentication", "authorization");
    } else if (module === "static-pattern") {
      categories.push("application-security");
    } else if (module === "smart-contract") {
      categories.push("smart-contracts");
    } else {
      categories.push(module);
    }
  }
  return [...new Set(categories)];
}
