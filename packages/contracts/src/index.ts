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

export interface PlaceholderServiceResponse {
  readonly service: "root-cause-investigation";
  readonly status: "not-implemented";
  readonly requestId: string;
  readonly message: string;
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

export type ServiceResponse =
  | PlaceholderServiceResponse
  | RepositoryIntelligenceResponse
  | SecurityAuditResponse;
