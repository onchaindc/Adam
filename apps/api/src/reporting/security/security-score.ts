import type {
  IntelligentSecurityFinding,
  SecurityCategoryScore,
  SecurityLikelihood,
  SecurityScore,
  SecurityScoreCategory,
  SecuritySeverity,
} from "@adam/contracts";

const severityPoints: Readonly<Record<SecuritySeverity, number>> = {
  critical: 35,
  high: 20,
  medium: 10,
  low: 4,
};

const confidenceMultiplier = {
  high: 1,
  medium: 0.75,
  low: 0.5,
} as const;

const likelihoodMultiplier: Readonly<Record<SecurityLikelihood, number>> = {
  high: 1,
  medium: 0.8,
  low: 0.6,
};

const categoryWeights: Readonly<Record<SecurityScoreCategory, number>> = {
  authentication: 1.2,
  authorization: 1.2,
  dependencies: 1,
  secrets: 1.4,
  configuration: 1,
  "application-security": 1.1,
  "smart-contracts": 1.4,
};

export function calculateSecurityScore(
  findings: readonly IntelligentSecurityFinding[],
  categories: readonly SecurityScoreCategory[],
): SecurityScore {
  const categoryScores = categories.map((category) =>
    calculateCategoryScore(category, findings.filter(
      (finding) => scoreCategoryForFinding(finding) === category,
    )),
  );
  const weightedTotal = categoryScores.reduce(
    (total, category) =>
      total + category.score * categoryWeights[category.category],
    0,
  );
  const totalWeight = categoryScores.reduce(
    (total, category) => total + categoryWeights[category.category],
    0,
  );
  const value =
    totalWeight === 0 ? 100 : Math.round(weightedTotal / totalWeight);
  const findingRisk = riskFromFindings(findings);
  const scoreRisk = riskFromScore(value);

  return {
    value,
    maximum: 100,
    scoringVersion: "1.0",
    riskRating: higherRisk(findingRisk, scoreRisk),
    categoryScores,
  };
}

export function scoreCategoryForFinding(
  finding: IntelligentSecurityFinding,
): SecurityScoreCategory {
  if (finding.category === "authentication-authorization") {
    return finding.ruleId === "AUTH-CLIENT-CONTROLLED-ROLE"
      ? "authorization"
      : "authentication";
  }
  if (finding.category === "static-pattern") {
    return "application-security";
  }
  if (finding.category === "smart-contract") {
    return "smart-contracts";
  }
  return finding.category;
}

function calculateCategoryScore(
  category: SecurityScoreCategory,
  findings: readonly IntelligentSecurityFinding[],
): SecurityCategoryScore {
  const deductions = findings.map((finding) => ({
    findingId: finding.id,
    points: Math.max(
      1,
      Math.round(
        severityPoints[finding.severity] *
          confidenceMultiplier[finding.intelligence.confidenceLevel] *
          likelihoodMultiplier[finding.intelligence.likelihood],
      ),
    ),
  }));
  const totalDeduction = deductions.reduce(
    (total, deduction) => total + deduction.points,
    0,
  );
  const score = Math.max(0, 100 - totalDeduction);

  return {
    category,
    score,
    riskRating: higherRisk(
      riskFromFindings(findings),
      riskFromScore(score),
    ),
    findingCount: findings.length,
    deductions,
  };
}

function riskFromFindings(
  findings: readonly IntelligentSecurityFinding[],
): SecuritySeverity {
  if (
    findings.some(
      (finding) =>
        finding.severity === "critical" &&
        finding.intelligence.confidenceLevel !== "low" &&
        finding.intelligence.likelihood !== "low",
    )
  ) {
    return "critical";
  }
  if (
    findings.some(
      (finding) =>
        (finding.severity === "critical" &&
          finding.intelligence.likelihood !== "low") ||
        (finding.severity === "high" &&
          finding.intelligence.confidenceLevel === "high" &&
          finding.intelligence.likelihood !== "low"),
    )
  ) {
    return "high";
  }
  if (
    findings.some(
      (finding) =>
        finding.severity === "high" || finding.severity === "medium",
    )
  ) {
    return "medium";
  }
  return "low";
}

function riskFromScore(score: number): SecuritySeverity {
  if (score < 40) {
    return "critical";
  }
  if (score < 65) {
    return "high";
  }
  if (score < 85) {
    return "medium";
  }
  return "low";
}

function higherRisk(
  left: SecuritySeverity,
  right: SecuritySeverity,
): SecuritySeverity {
  const rank: Readonly<Record<SecuritySeverity, number>> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  return rank[left] >= rank[right] ? left : right;
}
