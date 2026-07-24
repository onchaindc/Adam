import type { RepositoryModel } from "../repository/model.js";
import { extractErrorSignals } from "./error-signal-extractor.js";
import type { LogNormalizer } from "./log-normalizer.js";
import type {
  InvestigationLogInput,
  RootCauseCandidate,
  RootCauseDetector,
} from "./types.js";

export interface RootCauseEngineResult {
  readonly candidate: RootCauseCandidate;
  readonly entries: ReturnType<LogNormalizer["normalize"]>["entries"];
  readonly candidateCount: number;
  readonly limitations: readonly string[];
}

export class RootCauseEngine {
  public constructor(
    private readonly normalizer: LogNormalizer,
    private readonly detectors: readonly RootCauseDetector[],
  ) {}

  public investigate(
    model: RepositoryModel,
    logs: readonly InvestigationLogInput[],
  ): RootCauseEngineResult {
    const normalized = this.normalizer.normalize(logs);
    const signals = extractErrorSignals(normalized.entries);
    const context = {
      model,
      entries: normalized.entries,
      signals,
    };
    const candidates = this.detectors
      .flatMap((detector) => detector.detect(context))
      .sort(rankCandidates);
    const candidate =
      candidates[0] ?? buildUndeterminedCandidate(normalized.entries, signals);
    const limitations = [
      ...model.analysisLimitations,
      "Root cause ranking is based on deterministic log signatures and repository correlation; Adam does not execute or reproduce the failing system.",
      "Only supplied logs and the analyzed repository commit are considered.",
    ];
    if (normalized.truncated) {
      limitations.push(
        "Log normalization reached the configured line limit; later entries were not analyzed.",
      );
    }
    if (signals.length === 0) {
      limitations.push(
        "No explicit error signal was identified in the supplied log entries.",
      );
    }

    return {
      candidate,
      entries: normalized.entries,
      candidateCount: candidates.length,
      limitations,
    };
  }
}

function rankCandidates(
  left: RootCauseCandidate,
  right: RootCauseCandidate,
): number {
  return (
    right.score - left.score ||
    right.supportingEntryIds.length - left.supportingEntryIds.length ||
    right.relatedFiles.length - left.relatedFiles.length ||
    left.category.localeCompare(right.category)
  );
}

function buildUndeterminedCandidate(
  entries: ReturnType<LogNormalizer["normalize"]>["entries"],
  signals: ReturnType<typeof extractErrorSignals>,
): RootCauseCandidate {
  const supportingEntryIds = (
    signals.length > 0
      ? signals.map((signal) => signal.entryId)
      : entries.map((entry) => entry.id)
  ).slice(0, 5);

  return {
    detectorId: "fallback",
    category: "undetermined",
    title: "Root cause could not be determined",
    summary:
      "The supplied evidence does not contain a supported failure signature strong enough to select a specific root cause.",
    score: signals.length > 0 ? 35 : 15,
    impact:
      "The observed failure remains unresolved because the available evidence is incomplete or outside the current detector catalog.",
    recommendedFixes: [
      "Provide the earliest complete error, surrounding log lines, and an application stack trace.",
      "Include the failing command, runtime version, deployment platform, and relevant environment-variable names without secret values.",
    ],
    prevention: [
      "Emit structured errors with timestamps, component names, release identifiers, and preserved causes.",
      "Retain bounded build and runtime logs for failed releases.",
    ],
    supportingEntryIds,
    relatedFiles: [],
    relatedDependencies: [],
  };
}
