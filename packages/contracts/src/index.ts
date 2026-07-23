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

export interface SecurityAuditResponse {
  readonly service: "security-audit";
  readonly status: "completed";
  readonly requestId: string;
  readonly repository: RepositorySummary["repository"];
  readonly modulesExecuted: readonly SecurityFindingCategory[];
  readonly filesAnalyzed: number;
  readonly findings: readonly SecurityFinding[];
  readonly limitations: readonly string[];
}

export type ServiceResponse =
  | PlaceholderServiceResponse
  | RepositoryIntelligenceResponse
  | SecurityAuditResponse;
