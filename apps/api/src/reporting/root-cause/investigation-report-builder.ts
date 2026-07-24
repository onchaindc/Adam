import type {
  DetectionConfidence,
  InvestigationEvidence,
  SupportingLogEntry,
} from "@adam/contracts";

import type { RepositoryModel } from "../../investigation/repository/model.js";
import type { RootCauseCandidate } from "../../investigation/root-cause/types.js";
import type { UntracedRootCauseInvestigationResponse } from "../../traceability/types.js";

export const INVESTIGATION_PIPELINE = [
  "receive-inputs",
  "normalize-logs",
  "identify-error-signals",
  "correlate-repository-context",
  "generate-candidate-causes",
  "rank-causes",
  "select-most-probable-cause",
  "produce-investigation-result",
] as const;

export function buildInvestigationResponse(input: {
  readonly requestId: string;
  readonly model: RepositoryModel;
  readonly candidate: RootCauseCandidate;
  readonly entries: readonly SupportingLogEntry[];
  readonly limitations: readonly string[];
}): UntracedRootCauseInvestigationResponse {
  const supportingLogEntries = input.entries
    .filter((entry) =>
      input.candidate.supportingEntryIds.includes(entry.id),
    )
    .slice(0, 20);
  const confidence = {
    score: input.candidate.score,
    level: confidenceLevel(input.candidate.score),
  };

  return {
    service: "root-cause-investigation",
    status: "completed",
    requestId: input.requestId,
    investigationId: `ADAM-RCI-${input.requestId}`,
    repository: input.model.identity,
    rootCause: {
      category: input.candidate.category,
      title: input.candidate.title,
      summary: input.candidate.summary,
    },
    confidence,
    evidence: buildEvidence(
      supportingLogEntries,
      input.candidate.relatedFiles,
      input.candidate.relatedDependencies,
    ),
    impact: input.candidate.impact,
    recommendedFixes: input.candidate.recommendedFixes,
    prevention: input.candidate.prevention,
    relatedFiles: input.candidate.relatedFiles,
    relatedDependencies: input.candidate.relatedDependencies,
    supportingLogEntries,
    pipeline: INVESTIGATION_PIPELINE,
    limitations: input.limitations,
  };
}

function buildEvidence(
  entries: readonly SupportingLogEntry[],
  files: readonly string[],
  dependencies: readonly string[],
): readonly InvestigationEvidence[] {
  const evidence: InvestigationEvidence[] = [];

  for (const entry of entries) {
    evidence.push({
      id: evidenceId(evidence.length),
      type: entry.source === "stack-trace" ? "stack" : "log-entry",
      source: entry.source,
      reference: `${entry.label ?? entry.source}:line-${entry.line}`,
      excerpt: entry.text,
    });
  }
  for (const file of files) {
    evidence.push({
      id: evidenceId(evidence.length),
      type: "repository-file",
      source: "repository",
      reference: file,
      excerpt: "File exists in the analyzed repository commit.",
    });
  }
  for (const dependency of dependencies) {
    evidence.push({
      id: evidenceId(evidence.length),
      type: "dependency",
      source: "repository-manifest",
      reference: dependency,
      excerpt: "Dependency is declared in an analyzed package manifest.",
    });
  }

  return evidence;
}

function evidenceId(index: number): string {
  return `ADAM-RCI-EVID-${String(index + 1).padStart(4, "0")}`;
}

function confidenceLevel(score: number): DetectionConfidence {
  if (score >= 80) {
    return "high";
  }
  if (score >= 55) {
    return "medium";
  }
  return "low";
}
