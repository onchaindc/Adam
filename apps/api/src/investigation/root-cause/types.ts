import type {
  InvestigationLogSource,
  RootCauseCategory,
  SupportingLogEntry,
} from "@adam/contracts";

import type { RepositoryModel } from "../repository/model.js";

export interface InvestigationLogInput {
  readonly source: InvestigationLogSource;
  readonly label?: string;
  readonly content: string;
}

export interface ErrorSignal {
  readonly id: string;
  readonly entryId: string;
  readonly source: InvestigationLogSource;
  readonly line: number;
  readonly message: string;
  readonly strength: number;
}

export interface RootCauseCandidate {
  readonly detectorId: string;
  readonly category: RootCauseCategory;
  readonly title: string;
  readonly summary: string;
  readonly score: number;
  readonly impact: string;
  readonly recommendedFixes: readonly string[];
  readonly prevention: readonly string[];
  readonly supportingEntryIds: readonly string[];
  readonly relatedFiles: readonly string[];
  readonly relatedDependencies: readonly string[];
}

export interface RootCauseContext {
  readonly model: RepositoryModel;
  readonly entries: readonly SupportingLogEntry[];
  readonly signals: readonly ErrorSignal[];
}

export interface RootCauseDetector {
  readonly id: string;
  detect(context: RootCauseContext): readonly RootCauseCandidate[];
}

export interface CauseRule {
  readonly category: Exclude<RootCauseCategory, "undetermined">;
  readonly title: string;
  readonly summary: string;
  readonly patterns: readonly RegExp[];
  readonly baseScore: number;
  readonly preferredSources: readonly InvestigationLogSource[];
  readonly impact: string;
  readonly recommendedFixes: readonly string[];
  readonly prevention: readonly string[];
}
