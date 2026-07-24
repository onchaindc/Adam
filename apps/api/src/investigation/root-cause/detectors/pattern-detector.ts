import type { RootCauseCategory } from "@adam/contracts";

import { correlateRepositoryContext } from "../repository-correlation.js";
import type {
  CauseRule,
  RootCauseCandidate,
  RootCauseContext,
  RootCauseDetector,
} from "../types.js";

export class PatternRootCauseDetector implements RootCauseDetector {
  public constructor(
    public readonly id: string,
    private readonly rules: readonly CauseRule[],
  ) {}

  public detect(context: RootCauseContext): readonly RootCauseCandidate[] {
    return this.rules.flatMap((rule) => {
      const matchedEntries = context.entries.filter((entry) =>
        rule.patterns.some((pattern) => pattern.test(entry.text)),
      );
      if (matchedEntries.length === 0) {
        return [];
      }

      const supportingEntryIds = [
        ...new Set(matchedEntries.map((entry) => entry.id)),
      ];
      const matchingSignals = context.signals.filter((signal) =>
        supportingEntryIds.includes(signal.entryId),
      );
      const correlation = correlateRepositoryContext(
        context.model,
        context.entries.map((entry) => entry.text),
      );
      const relatedFiles = [
        ...new Set([
          ...correlation.relatedFiles,
          ...contextFiles(rule.category, context),
        ]),
      ].slice(0, 20);
      const sourceBoost = matchedEntries.some((entry) =>
        rule.preferredSources.includes(entry.source),
      )
        ? 8
        : 0;
      const signalBoost = Math.min(
        18,
        matchingSignals.reduce(
          (total, signal) => total + signal.strength * 2,
          0,
        ),
      );
      const matchBoost = Math.min(24, supportingEntryIds.length * 6);
      const contextBoost = Math.min(
        15,
        relatedFiles.length * 3 +
          correlation.relatedDependencies.length * 4 +
          categoryContextBoost(rule.category, context),
      );

      return [
        {
          detectorId: this.id,
          category: rule.category,
          title: rule.title,
          summary: rule.summary,
          score: Math.min(
            99,
            rule.baseScore +
              sourceBoost +
              signalBoost +
              matchBoost +
              contextBoost,
          ),
          impact: rule.impact,
          recommendedFixes: rule.recommendedFixes,
          prevention: rule.prevention,
          supportingEntryIds,
          relatedFiles,
          relatedDependencies: correlation.relatedDependencies,
        },
      ];
    });
  }
}

function contextFiles(
  category: RootCauseCategory,
  context: RootCauseContext,
): readonly string[] {
  const summary = context.model.summary;
  if (category === "missing-environment-variable") {
    return [
      ...summary.environmentFiles,
      ...summary.configurationFiles,
    ].slice(0, 10);
  }
  if (category === "configuration-mistake") {
    return summary.configurationFiles.slice(0, 10);
  }
  if (
    category === "dependency-failure" ||
    category === "module-resolution" ||
    category === "version-incompatibility"
  ) {
    return Object.keys(context.model.manifestContents).slice(0, 10);
  }
  if (category === "deployment-failure") {
    return [
      ...summary.docker.files,
      ...summary.ciCd.files,
      ...summary.configurationFiles,
    ].slice(0, 10);
  }
  if (category === "build-failure") {
    return [
      ...summary.ciCd.files,
      ...summary.configurationFiles,
    ].slice(0, 10);
  }
  if (category === "smart-contract-deployment-failure") {
    return summary.smartContracts.solidityFiles.slice(0, 10);
  }
  return [];
}

function categoryContextBoost(
  category: RootCauseCategory,
  context: RootCauseContext,
): number {
  const summary = context.model.summary;
  if (
    category === "smart-contract-deployment-failure" &&
    summary.smartContracts.detected
  ) {
    return 8;
  }
  if (
    category === "missing-environment-variable" &&
    (summary.environmentFiles.length > 0 ||
      summary.configurationFiles.length > 0)
  ) {
    return 5;
  }
  if (
    category === "deployment-failure" &&
    (summary.docker.detected || summary.ciCd.detected)
  ) {
    return 5;
  }
  if (
    (category === "dependency-failure" ||
      category === "module-resolution" ||
      category === "version-incompatibility") &&
    summary.packageManager !== null
  ) {
    return 4;
  }
  return 0;
}
