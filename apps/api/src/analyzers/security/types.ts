import type {
  DetectionConfidence,
  SecurityFindingCategory,
  SecuritySeverity,
} from "@adam/contracts";

import type { RepositoryModel } from "../../investigation/repository/model.js";

export interface SecurityFindingCandidate {
  readonly ruleId: string;
  readonly category: SecurityFindingCategory;
  readonly title: string;
  readonly severity: SecuritySeverity;
  readonly file: string;
  readonly line: number | null;
  readonly description: string;
  readonly evidence: string;
  readonly confidence: DetectionConfidence;
}

export interface SecurityInspector {
  readonly category: SecurityFindingCategory;
  inspect(model: RepositoryModel): readonly SecurityFindingCandidate[];
}
