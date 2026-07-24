import type {
  PlannerUnifiedResponse,
  RecommendedSecurityFix,
  RootCauseInvestigationResponse,
  SecurityAuditResponse,
} from "@adam/contracts";

export type UntracedSecurityAuditResponse = Omit<
  SecurityAuditResponse,
  | "analysisMode"
  | "recommendedFixOrder"
  | "recommendations"
  | "traceability"
  | "aiIntelligence"
> & {
  readonly recommendedFixOrder: readonly RecommendedSecurityFix[];
};

export type UntracedRootCauseInvestigationResponse = Omit<
  RootCauseInvestigationResponse,
  | "analysisMode"
  | "recommendations"
  | "traceability"
  | "aiIntelligence"
>;

export type UntracedPlannerUnifiedResponse = Omit<
  PlannerUnifiedResponse,
  | "analysisMode"
  | "recommendations"
  | "traceability"
  | "aiIntelligence"
>;
