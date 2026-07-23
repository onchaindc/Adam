import type {
  SecurityFinding,
  SecurityFindingCategory,
  SecuritySeverity,
} from "@adam/contracts";

import type { RepositoryModel } from "../../investigation/repository/model.js";
import type {
  SecurityFindingCandidate,
  SecurityInspector,
} from "./types.js";

const severityOrder: Readonly<Record<SecuritySeverity, number>> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface SecurityAuditEngineResult {
  readonly modulesExecuted: readonly SecurityFindingCategory[];
  readonly filesAnalyzed: number;
  readonly findings: readonly SecurityFinding[];
  readonly limitations: readonly string[];
}

export class SecurityAuditEngine {
  public constructor(
    private readonly inspectors: readonly SecurityInspector[],
  ) {}

  public analyze(model: RepositoryModel): SecurityAuditEngineResult {
    const eligibleInspectors = this.inspectors.filter(
      (inspector) =>
        inspector.category !== "smart-contract" ||
        model.summary.smartContracts.detected,
    );
    const candidates = eligibleInspectors.flatMap((inspector) =>
      inspector.inspect(model),
    );
    const findings = assignFindingIds(deduplicateFindings(candidates));

    return {
      modulesExecuted: eligibleInspectors.map(
        (inspector) => inspector.category,
      ),
      filesAnalyzed: model.files.filter((file) => file.content !== null).length,
      findings,
      limitations: [
        ...model.analysisLimitations,
        "Dependency inspection uses committed manifests and offline policy baselines; it does not query live registries or vulnerability databases.",
        "Pattern findings identify risky constructs and require later contextual validation.",
      ],
    };
  }
}

function deduplicateFindings(
  findings: readonly SecurityFindingCandidate[],
): readonly SecurityFindingCandidate[] {
  const unique = new Map<string, SecurityFindingCandidate>();

  for (const finding of findings) {
    const key = [
      finding.ruleId,
      finding.file,
      finding.line ?? "none",
      finding.evidence,
    ].join(":");
    if (!unique.has(key)) {
      unique.set(key, finding);
    }
  }

  return [...unique.values()].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity] ||
      left.file.localeCompare(right.file) ||
      (left.line ?? Number.MAX_SAFE_INTEGER) -
        (right.line ?? Number.MAX_SAFE_INTEGER) ||
      left.ruleId.localeCompare(right.ruleId),
  );
}

function assignFindingIds(
  findings: readonly SecurityFindingCandidate[],
): readonly SecurityFinding[] {
  return findings.map((finding, index) => ({
    id: `ADAM-SEC-${String(index + 1).padStart(4, "0")}`,
    ...finding,
  }));
}
