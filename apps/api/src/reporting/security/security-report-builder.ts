import type {
  IntelligentSecurityFinding,
  RecommendedSecurityFix,
  RepositorySummary,
  SecurityReport,
  SecurityScore,
  SecuritySeverity,
} from "@adam/contracts";

export function buildRecommendedFixOrder(
  findings: readonly IntelligentSecurityFinding[],
): readonly RecommendedSecurityFix[] {
  return [...findings]
    .sort(
      (left, right) =>
        priorityValue(right) - priorityValue(left) ||
        left.file.localeCompare(right.file) ||
        (left.line ?? Number.MAX_SAFE_INTEGER) -
          (right.line ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
    )
    .map((finding, index) => ({
      priority: index + 1,
      findingId: finding.id,
      title: finding.title,
      severity: finding.severity,
      rationale: `${finding.id} is ranked as ${finding.severity} severity with ${finding.intelligence.likelihood} likelihood and ${finding.intelligence.confidenceLevel} confidence.`,
      suggestedRemediation: finding.intelligence.suggestedRemediation,
    }));
}

export function buildSecurityReport(input: {
  readonly repositorySummary: RepositorySummary;
  readonly filesAnalyzed: number;
  readonly findings: readonly IntelligentSecurityFinding[];
  readonly securityScore: SecurityScore;
  readonly recommendedFixOrder: readonly RecommendedSecurityFix[];
  readonly limitations: readonly string[];
}): SecurityReport {
  const grouped = {
    critical: input.findings.filter(
      (finding) => finding.severity === "critical",
    ),
    high: input.findings.filter((finding) => finding.severity === "high"),
    medium: input.findings.filter((finding) => finding.severity === "medium"),
    low: input.findings.filter((finding) => finding.severity === "low"),
  };
  const findingCounts: Readonly<Record<SecuritySeverity, number>> = {
    critical: grouped.critical.length,
    high: grouped.high.length,
    medium: grouped.medium.length,
    low: grouped.low.length,
  };

  return {
    schemaVersion: "1.0",
    repositoryOverview: {
      repository: input.repositorySummary.repository,
      filesAnalyzed: input.filesAnalyzed,
      dockerDetected: input.repositorySummary.docker.detected,
      ciCdDetected: input.repositorySummary.ciCd.detected,
      smartContractsDetected:
        input.repositorySummary.smartContracts.detected,
    },
    technologyStack: {
      languages: input.repositorySummary.languages,
      frameworks: input.repositorySummary.frameworks,
      packageManager: input.repositorySummary.packageManager,
    },
    securityScore: input.securityScore,
    overallRiskRating: input.securityScore.riskRating,
    criticalFindings: grouped.critical,
    highFindings: grouped.high,
    mediumFindings: grouped.medium,
    lowFindings: grouped.low,
    recommendedFixOrder: input.recommendedFixOrder,
    securitySummary: {
      overview: buildSummaryOverview(
        input.repositorySummary,
        input.findings,
        input.securityScore,
        findingCounts,
      ),
      findingCounts,
      highestPriorityFindingIds: input.recommendedFixOrder
        .slice(0, 3)
        .map((fix) => fix.findingId),
      evidenceBased: true,
    },
    limitations: input.limitations,
  };
}

function priorityValue(finding: IntelligentSecurityFinding): number {
  const severity = {
    critical: 400,
    high: 300,
    medium: 200,
    low: 100,
  }[finding.severity];
  const likelihood = {
    high: 30,
    medium: 20,
    low: 10,
  }[finding.intelligence.likelihood];
  const confidence = {
    high: 3,
    medium: 2,
    low: 1,
  }[finding.intelligence.confidenceLevel];
  return severity + likelihood + confidence;
}

function buildSummaryOverview(
  repository: RepositorySummary,
  findings: readonly IntelligentSecurityFinding[],
  score: SecurityScore,
  counts: Readonly<Record<SecuritySeverity, number>>,
): string {
  if (findings.length === 0) {
    return `Adam analyzed ${repository.repository.name} at commit ${repository.repository.commitSha} and produced no findings from the configured static analyzers. The score is 100/100 with a low risk rating; this does not prove that the repository is vulnerability-free.`;
  }

  const priorityIds = findings
    .filter(
      (finding) =>
        finding.severity === "critical" || finding.severity === "high",
    )
    .slice(0, 3)
    .map((finding) => finding.id);
  const countSummary = [
    `${counts.critical} critical`,
    `${counts.high} high`,
    `${counts.medium} medium`,
    `${counts.low} low`,
  ].join(", ");

  return `Adam analyzed ${repository.repository.name} at commit ${repository.repository.commitSha} and identified ${findings.length} evidence-backed findings (${countSummary}). The deterministic security score is ${score.value}/100 with an overall ${score.riskRating} risk rating. Highest-severity evidence references: ${priorityIds.join(", ") || "none"}.`;
}
