import type {
  InvestigationLogSource,
  PlannerIntent,
  PlannerIntentClassification,
  ServiceKind,
} from "@adam/contracts";

import type { RepositoryModel } from "../investigation/repository/model.js";

export interface PlannerLogInput {
  readonly source: InvestigationLogSource;
  readonly label?: string;
  readonly content: string;
}

export interface PlannerInput {
  readonly requestId: string;
  readonly request: string;
  readonly repositoryUrl: string;
  readonly logs: readonly PlannerLogInput[];
  readonly model: RepositoryModel;
}

export interface PlannerPreparation {
  readonly classification: PlannerIntentClassification;
  readonly plan: import("@adam/contracts").PlannerExecutionPlan;
}

export interface IntentSignal {
  readonly name: string;
  readonly pattern: RegExp;
}

export interface IntentClassifier {
  classify(request: string): PlannerIntentClassification;
}

export interface ServiceCapability {
  readonly service: ServiceKind;
  readonly prerequisites: readonly ServiceKind[];
  readonly reason: string;
}

export interface IntentTarget {
  readonly intent: PlannerIntent;
  readonly services: readonly ServiceKind[];
}
