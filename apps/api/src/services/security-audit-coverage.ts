import type {
  SecurityAuditCoverage,
  SecurityAuditEnrichment,
  SecurityCoverageStatus,
  SecurityFindingCategory,
  SecurityProfile,
} from "@adam/contracts";

import type { RepositoryModel } from "../investigation/repository/model.js";

export function buildSecurityAuditCoverage(input: {
  readonly model: RepositoryModel;
  readonly profile: SecurityProfile;
  readonly modulesExecuted: readonly SecurityFindingCategory[];
  readonly enrichment: SecurityAuditEnrichment;
}): SecurityAuditCoverage {
  const checks: SecurityAuditCoverage["checks"] = [
    {
      id: "repository-snapshot",
      name: "Repository snapshot",
      status: "completed",
      summary:
        `${input.model.summary.totalFilesScanned} files were mapped at commit ${input.model.identity.commitSha}.`,
      limitation:
        "Local, untracked, gitignored, deleted, and deployment-only files are outside the acquired snapshot.",
    },
    {
      id: "static-analysis",
      name: "Deterministic static analysis",
      status: "completed",
      summary:
        `${input.modulesExecuted.length} security modules executed: ${input.modulesExecuted.join(", ")}.`,
      limitation:
        "Static findings do not by themselves prove runtime reachability or exploitability.",
    },
    {
      id: "live-vulnerabilities",
      name: "Live dependency advisories",
      status: input.enrichment.liveVulnerabilities.status,
      summary: liveSummary(input.enrichment),
      limitation: input.enrichment.liveVulnerabilities.limitation,
    },
    {
      id: "git-history-secrets",
      name: "Git-history secret scanning",
      status: input.enrichment.gitHistorySecrets.status,
      summary:
        `${input.enrichment.gitHistorySecrets.commitsScanned} commits scanned; ${input.enrichment.gitHistorySecrets.findingsFound} historical secret findings produced.`,
      limitation: input.enrichment.gitHistorySecrets.limitation,
    },
    {
      id: "runtime-analysis",
      name: "Sandboxed build and test validation",
      status: runtimeCoverageStatus(
        input.enrichment.runtimeAnalysis.status,
      ),
      summary:
        `${input.enrichment.runtimeAnalysis.checks.length} isolated runtime checks recorded.`,
      limitation: input.enrichment.runtimeAnalysis.limitation,
    },
  ];

  return {
    schemaVersion: "1.0",
    assurance: assuranceLevel(input.profile, checks),
    checks,
  };
}

function liveSummary(enrichment: SecurityAuditEnrichment): string {
  const live = enrichment.liveVulnerabilities;
  return `${live.packagesChecked} exact package versions checked; ${live.advisoriesFound} advisories found.`;
}

function runtimeCoverageStatus(
  status: SecurityAuditEnrichment["runtimeAnalysis"]["status"],
): SecurityCoverageStatus {
  return status;
}

function assuranceLevel(
  profile: SecurityProfile,
  checks: SecurityAuditCoverage["checks"],
): SecurityAuditCoverage["assurance"] {
  const status = new Map(checks.map((check) => [check.id, check.status]));
  if (
    profile === "sandboxed" &&
    status.get("live-vulnerabilities") === "completed" &&
    status.get("git-history-secrets") === "completed" &&
    status.get("runtime-analysis") === "completed"
  ) {
    return "strong";
  }
  if (
    profile !== "static" &&
    status.get("live-vulnerabilities") === "completed" &&
    (
      status.get("git-history-secrets") === "completed" ||
      status.get("git-history-secrets") === "partial"
    )
  ) {
    return "moderate";
  }
  return "limited";
}
