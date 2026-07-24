export const SERVICE_KINDS = [
  "repository-intelligence",
  "security-audit",
  "root-cause-investigation",
] as const;

export type ServiceKind = (typeof SERVICE_KINDS)[number];

export interface PlannerDecision {
  readonly service: ServiceKind;
  readonly prerequisites: readonly "repository-intelligence"[];
}

export interface ServiceRequest {
  readonly requestId: string;
  readonly input: unknown;
}

export type DetectionConfidence = "high" | "medium" | "low";

export interface StackDetection {
  readonly name: string;
  readonly confidence: DetectionConfidence;
  readonly evidence: readonly string[];
}

export interface RepositoryLanguage {
  readonly name: string;
  readonly fileCount: number;
  readonly percentage: number;
}

export interface RepositorySummary {
  readonly repository: {
    readonly name: string;
    readonly owner: string;
    readonly url: string;
    readonly defaultBranch: string;
    readonly commitSha: string;
  };
  readonly languages: readonly RepositoryLanguage[];
  readonly frameworks: readonly StackDetection[];
  readonly packageManager: StackDetection | null;
  readonly structure: {
    readonly topLevelEntries: readonly string[];
    readonly directories: readonly string[];
    readonly fileTree: readonly string[];
  };
  readonly docker: {
    readonly detected: boolean;
    readonly files: readonly string[];
  };
  readonly ciCd: {
    readonly detected: boolean;
    readonly files: readonly string[];
  };
  readonly smartContracts: {
    readonly detected: boolean;
    readonly solidityFiles: readonly string[];
  };
  readonly environmentFiles: readonly string[];
  readonly configurationFiles: readonly string[];
  readonly totalFilesScanned: number;
  readonly ignoredDirectories: readonly string[];
  readonly limitations: readonly string[];
}

export interface RepositoryIntelligenceResponse {
  readonly service: "repository-intelligence";
  readonly status: "completed";
  readonly requestId: string;
  readonly summary: RepositorySummary;
}

export type SecuritySeverity = "critical" | "high" | "medium" | "low";

export type SecurityFindingCategory =
  | "secrets"
  | "dependencies"
  | "authentication-authorization"
  | "configuration"
  | "static-pattern"
  | "smart-contract";

export interface SecurityFinding {
  readonly id: string;
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

export type SecurityLikelihood = "high" | "medium" | "low";

export type SecurityScoreCategory =
  | "authentication"
  | "authorization"
  | "dependencies"
  | "secrets"
  | "configuration"
  | "application-security"
  | "smart-contracts";

export interface SecurityFindingIntelligence {
  readonly explanation: string;
  readonly whyItMatters: string;
  readonly potentialImpact: string;
  readonly likelihood: SecurityLikelihood;
  readonly suggestedRemediation: string;
  readonly confidenceLevel: DetectionConfidence;
  readonly evidenceReferences: readonly string[];
}

export interface IntelligentSecurityFinding extends SecurityFinding {
  readonly intelligence: SecurityFindingIntelligence;
}

export interface SecurityScoreDeduction {
  readonly findingId: string;
  readonly points: number;
}

export interface SecurityCategoryScore {
  readonly category: SecurityScoreCategory;
  readonly score: number;
  readonly riskRating: SecuritySeverity;
  readonly findingCount: number;
  readonly deductions: readonly SecurityScoreDeduction[];
}

export interface SecurityScore {
  readonly value: number;
  readonly maximum: 100;
  readonly scoringVersion: "1.0";
  readonly riskRating: SecuritySeverity;
  readonly categoryScores: readonly SecurityCategoryScore[];
}

export interface RecommendedSecurityFix {
  readonly priority: number;
  readonly findingId: string;
  readonly title: string;
  readonly severity: SecuritySeverity;
  readonly rationale: string;
  readonly suggestedRemediation: string;
}

export interface SecurityReport {
  readonly schemaVersion: "1.0";
  readonly repositoryOverview: {
    readonly repository: RepositorySummary["repository"];
    readonly filesAnalyzed: number;
    readonly dockerDetected: boolean;
    readonly ciCdDetected: boolean;
    readonly smartContractsDetected: boolean;
  };
  readonly technologyStack: {
    readonly languages: readonly RepositoryLanguage[];
    readonly frameworks: readonly StackDetection[];
    readonly packageManager: StackDetection | null;
  };
  readonly securityScore: SecurityScore;
  readonly overallRiskRating: SecuritySeverity;
  readonly criticalFindings: readonly IntelligentSecurityFinding[];
  readonly highFindings: readonly IntelligentSecurityFinding[];
  readonly mediumFindings: readonly IntelligentSecurityFinding[];
  readonly lowFindings: readonly IntelligentSecurityFinding[];
  readonly recommendedFixOrder: readonly RecommendedSecurityFix[];
  readonly securitySummary: {
    readonly overview: string;
    readonly findingCounts: Readonly<Record<SecuritySeverity, number>>;
    readonly highestPriorityFindingIds: readonly string[];
    readonly evidenceBased: true;
  };
  readonly limitations: readonly string[];
}

export interface SecurityAuditResponse {
  readonly service: "security-audit";
  readonly status: "completed";
  readonly requestId: string;
  readonly repository: RepositorySummary["repository"];
  readonly modulesExecuted: readonly SecurityFindingCategory[];
  readonly filesAnalyzed: number;
  readonly findings: readonly IntelligentSecurityFinding[];
  readonly securityScore: SecurityScore;
  readonly overallRiskRating: SecuritySeverity;
  readonly recommendedFixOrder: readonly RecommendedSecurityFix[];
  readonly report: SecurityReport;
  readonly limitations: readonly string[];
}

export type InvestigationLogSource =
  | "build"
  | "runtime"
  | "ci"
  | "stack-trace"
  | "error-message";

export type RootCauseCategory =
  | "dependency-failure"
  | "missing-environment-variable"
  | "configuration-mistake"
  | "build-failure"
  | "runtime-exception"
  | "module-resolution"
  | "version-incompatibility"
  | "deployment-failure"
  | "authentication-failure"
  | "database-connection-failure"
  | "api-integration-failure"
  | "smart-contract-deployment-failure"
  | "undetermined";

export interface InvestigationConfidence {
  readonly score: number;
  readonly level: DetectionConfidence;
}

export interface InvestigationEvidence {
  readonly id: string;
  readonly type: "log-entry" | "repository-file" | "dependency" | "stack";
  readonly source: string;
  readonly reference: string;
  readonly excerpt: string;
}

export interface SupportingLogEntry {
  readonly id: string;
  readonly source: InvestigationLogSource;
  readonly label: string | null;
  readonly line: number;
  readonly timestamp: string | null;
  readonly text: string;
}

export interface RootCauseInvestigationResponse {
  readonly service: "root-cause-investigation";
  readonly status: "completed";
  readonly requestId: string;
  readonly investigationId: string;
  readonly repository: RepositorySummary["repository"];
  readonly rootCause: {
    readonly category: RootCauseCategory;
    readonly title: string;
    readonly summary: string;
  };
  readonly confidence: InvestigationConfidence;
  readonly evidence: readonly InvestigationEvidence[];
  readonly impact: string;
  readonly recommendedFixes: readonly string[];
  readonly prevention: readonly string[];
  readonly relatedFiles: readonly string[];
  readonly relatedDependencies: readonly string[];
  readonly supportingLogEntries: readonly SupportingLogEntry[];
  readonly pipeline: readonly [
    "receive-inputs",
    "normalize-logs",
    "identify-error-signals",
    "correlate-repository-context",
    "generate-candidate-causes",
    "rank-causes",
    "select-most-probable-cause",
    "produce-investigation-result",
  ];
  readonly limitations: readonly string[];
}

export type ServiceResponse =
  | RepositoryIntelligenceResponse
  | SecurityAuditResponse
  | RootCauseInvestigationResponse;
