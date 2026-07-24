export const SERVICE_KINDS = [
  "repository-intelligence",
  "security-audit",
  "root-cause-investigation",
  "pull-request-review",
] as const;

export type ServiceKind = (typeof SERVICE_KINDS)[number];

export interface PlannerDecision {
  readonly service: ServiceKind;
  readonly prerequisites: readonly ServiceKind[];
}

export interface ServiceRequest {
  readonly requestId: string;
  readonly input: unknown;
}

export type DetectionConfidence = "high" | "medium" | "low";
export type AnalysisMode = "deterministic" | "intelligent";
export type AiProviderName = "openai" | "gemini";

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

export type TraceabilitySourceService =
  | "security-audit"
  | "root-cause-investigation";

export interface FindingTraceability {
  readonly findingId: string;
  readonly evidenceIds: readonly string[];
  readonly repositoryFile: string | null;
  readonly lineNumbers: readonly number[];
  readonly ruleId: string;
  readonly confidence: DetectionConfidence;
  readonly sourceService: TraceabilitySourceService;
}

export interface TraceableEvidence {
  readonly evidenceId: string;
  readonly relatedFindingIds: readonly string[];
  readonly repositoryFile: string | null;
  readonly lineNumbers: readonly number[];
  readonly ruleId: string;
  readonly confidence: DetectionConfidence;
  readonly sourceService: TraceabilitySourceService;
  readonly excerpt: string;
}

export interface TraceableRecommendation {
  readonly recommendationId: string;
  readonly text: string;
  readonly relatedFindingIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly repositoryFile: string | null;
  readonly lineNumbers: readonly number[];
  readonly ruleId: string;
  readonly confidence: DetectionConfidence;
  readonly sourceService: TraceabilitySourceService;
}

export interface TraceableRecommendedSecurityFix
  extends RecommendedSecurityFix,
    TraceableRecommendation {}

export interface EvidenceTraceability {
  readonly complete: true;
  readonly findings: readonly FindingTraceability[];
  readonly evidence: readonly TraceableEvidence[];
  readonly recommendations: readonly TraceableRecommendation[];
}

export interface AiReasoningSection {
  readonly content: string;
  readonly findingIds: readonly string[];
}

export interface AiIntelligenceReport {
  readonly status: "completed" | "insufficient-evidence";
  readonly provider: AiProviderName | null;
  readonly model: string | null;
  readonly cacheHit: boolean;
  readonly executiveSummary: AiReasoningSection;
  readonly developerSummary: AiReasoningSection;
  readonly businessImpact: AiReasoningSection;
  readonly attackNarrative: AiReasoningSection;
  readonly remediationStrategy: AiReasoningSection;
  readonly priorityRoadmap: AiReasoningSection;
  readonly architectureObservations: AiReasoningSection;
  readonly confidenceSummary: AiReasoningSection;
  readonly limitations: readonly string[];
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
  readonly analysisMode: AnalysisMode;
  readonly repository: RepositorySummary["repository"];
  readonly modulesExecuted: readonly SecurityFindingCategory[];
  readonly filesAnalyzed: number;
  readonly findings: readonly IntelligentSecurityFinding[];
  readonly securityScore: SecurityScore;
  readonly overallRiskRating: SecuritySeverity;
  readonly recommendedFixOrder: readonly TraceableRecommendedSecurityFix[];
  readonly recommendations: readonly TraceableRecommendation[];
  readonly traceability: EvidenceTraceability;
  readonly aiIntelligence: AiIntelligenceReport | null;
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
  readonly analysisMode: AnalysisMode;
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
  readonly recommendations: readonly TraceableRecommendation[];
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
  readonly traceability: EvidenceTraceability;
  readonly aiIntelligence: AiIntelligenceReport | null;
  readonly limitations: readonly string[];
}

export type PullRequestFileStatus =
  | "added"
  | "modified"
  | "removed"
  | "renamed"
  | "copied"
  | "changed"
  | "unchanged";

export interface PullRequestMetadata {
  readonly owner: string;
  readonly repository: string;
  readonly number: number;
  readonly url: string;
  readonly title: string;
  readonly description: string | null;
  readonly author: string;
  readonly state: "open" | "closed";
  readonly draft: boolean;
  readonly baseBranch: string;
  readonly headBranch: string;
  readonly baseSha: string;
  readonly headSha: string;
  readonly commitCount: number;
  readonly changedFileCount: number;
  readonly additions: number;
  readonly deletions: number;
}

export interface PullRequestChangedFile {
  readonly filename: string;
  readonly previousFilename: string | null;
  readonly status: PullRequestFileStatus;
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
  readonly patch: string | null;
  readonly contentAvailable: boolean;
}

export interface PullRequestAiReview {
  readonly status: "completed" | "insufficient-evidence";
  readonly provider: AiProviderName | null;
  readonly model: string | null;
  readonly cacheHit: boolean;
  readonly securityObservations: AiReasoningSection;
  readonly possibleBugs: AiReasoningSection;
  readonly maintainabilityConcerns: AiReasoningSection;
  readonly breakingChangeRisks: AiReasoningSection;
  readonly codeQualityComments: AiReasoningSection;
  readonly remediationStrategy: AiReasoningSection;
  readonly priorityRoadmap: AiReasoningSection;
  readonly confidenceSummary: AiReasoningSection;
  readonly limitations: readonly string[];
}

export interface PullRequestReviewResponse {
  readonly service: "pull-request-review";
  readonly status: "completed";
  readonly requestId: string;
  readonly analysisMode: AnalysisMode;
  readonly pullRequest: PullRequestMetadata;
  readonly summary: {
    readonly filesChanged: number;
    readonly filesAnalyzed: number;
    readonly filesWithPatches: number;
    readonly filesWithoutContent: number;
    readonly additions: number;
    readonly deletions: number;
    readonly limitations: readonly string[];
  };
  readonly repositorySummary: RepositorySummary;
  readonly riskRating: SecuritySeverity;
  readonly securityScore: SecurityScore;
  readonly changedFiles: readonly PullRequestChangedFile[];
  readonly findings: readonly IntelligentSecurityFinding[];
  readonly recommendations: readonly TraceableRecommendation[];
  readonly traceability: EvidenceTraceability;
  readonly aiReview: PullRequestAiReview | null;
}

export type PlannerIntent =
  | "repository-analysis"
  | "security-audit"
  | "root-cause-investigation"
  | "combined-analysis"
  | "pull-request-review";

export interface PlannerIntentClassification {
  readonly intent: PlannerIntent;
  readonly confidence: DetectionConfidence;
  readonly matchedSignals: readonly string[];
  readonly rationale: string;
}

export interface PlannerExecutionStep {
  readonly order: number;
  readonly service: ServiceKind;
  readonly prerequisites: readonly ServiceKind[];
  readonly reason: string;
}

export interface PlannerOmittedService {
  readonly service: ServiceKind;
  readonly reason: string;
}

export interface PlannerExecutionPlan {
  readonly intent: PlannerIntent;
  readonly steps: readonly PlannerExecutionStep[];
  readonly omittedServices: readonly PlannerOmittedService[];
}

export interface PlannerDecisionRecord {
  readonly stage: "intent-classification" | "execution-planning";
  readonly decision: string;
  readonly rationale: string;
}

export interface PlannerTimelineEntry {
  readonly service: ServiceKind;
  readonly status: "completed" | "failed";
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
}

export interface PlannerUnifiedResponse {
  readonly service: "planner";
  readonly status: "completed";
  readonly requestId: string;
  readonly analysisMode: AnalysisMode;
  readonly requestSummary: {
    readonly request: string;
    readonly intent: PlannerIntent;
    readonly confidence: DetectionConfidence;
  };
  readonly plannerDecision: {
    readonly classification: PlannerIntentClassification;
    readonly executionPlan: PlannerExecutionPlan;
    readonly decisions: readonly PlannerDecisionRecord[];
  };
  readonly servicesExecuted: readonly ServiceKind[];
  readonly repositoryOverview: RepositorySummary;
  readonly securityAssessment: SecurityAuditResponse | null;
  readonly rootCauseInvestigation: RootCauseInvestigationResponse | null;
  readonly pullRequestReview: PullRequestReviewResponse | null;
  readonly overallRisk: {
    readonly rating: SecuritySeverity | "not-assessed";
    readonly basis: string;
  };
  readonly overallRecommendations: readonly string[];
  readonly recommendations: readonly TraceableRecommendation[];
  readonly traceability: EvidenceTraceability;
  readonly aiIntelligence: AiIntelligenceReport | null;
  readonly executionMetadata: {
    readonly startedAt: string;
    readonly completedAt: string;
    readonly durationMs: number;
    readonly timeline: readonly PlannerTimelineEntry[];
    readonly sharedRepositoryModel: boolean;
    readonly repositoryAcquisitions: number;
  };
}

export type ServiceResponse =
  | RepositoryIntelligenceResponse
  | SecurityAuditResponse
  | RootCauseInvestigationResponse
  | PullRequestReviewResponse
  | PlannerUnifiedResponse;
