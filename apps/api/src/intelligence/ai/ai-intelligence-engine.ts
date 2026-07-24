import { createHash } from "node:crypto";

import type {
  AiIntelligenceReport,
  PlannerUnifiedResponse,
  RootCauseInvestigationResponse,
  SecurityAuditResponse,
} from "@adam/contracts";

import type { AiResultCache } from "./ai-result-cache.js";
import { AiIntelligenceError } from "./errors.js";
import type { PromptBuilder } from "./prompt-builder.js";
import type { ReasoningFormatter } from "./reasoning-formatter.js";
import type {
  AiEvidencePackage,
  AiFindingInput,
  AiReasoningProvider,
} from "./types.js";

export class AiIntelligenceEngine {
  public constructor(
    private readonly provider: AiReasoningProvider | null,
    private readonly promptBuilder: PromptBuilder,
    private readonly formatter: ReasoningFormatter,
    private readonly cache: AiResultCache,
  ) {}

  public async enhanceSecurity(
    response: SecurityAuditResponse,
  ): Promise<SecurityAuditResponse> {
    return {
      ...response,
      aiIntelligence: await this.analyze(buildSecurityPackage(response)),
    };
  }

  public async enhanceRootCause(
    response: RootCauseInvestigationResponse,
  ): Promise<RootCauseInvestigationResponse> {
    return {
      ...response,
      aiIntelligence: await this.analyze(buildRootCausePackage(response)),
    };
  }

  public async enhancePlanner(
    response: PlannerUnifiedResponse,
  ): Promise<PlannerUnifiedResponse> {
    return {
      ...response,
      aiIntelligence: await this.analyze(buildPlannerPackage(response)),
    };
  }

  private async analyze(
    evidencePackage: AiEvidencePackage,
  ): Promise<AiIntelligenceReport> {
    if (evidencePackage.findings.length === 0) {
      return insufficientEvidenceReport();
    }
    if (!this.provider) {
      throw new AiIntelligenceError(
        "ai-not-configured",
        "Intelligent analysis is not configured for the selected AI_PROVIDER.",
      );
    }

    const cacheKey = createHash("sha256")
      .update(JSON.stringify(evidencePackage))
      .digest("hex");
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const prompt = this.promptBuilder.build(evidencePackage);
    const providerResult = await this.provider.generate(prompt);
    const reasoning = this.formatter.format(
      providerResult.outputText,
      evidencePackage.findings.map((finding) => finding.findingId),
    );
    const report: AiIntelligenceReport = {
      status: "completed",
      provider: providerResult.provider,
      model: providerResult.model,
      cacheHit: false,
      ...reasoning,
      limitations: [
        "AI intelligence is constrained to deterministic findings and evidence supplied by Adam.",
        "AI output does not create, remove, or change findings, confidence, root-cause selection, or security scores.",
        "Exploitability and business-impact statements remain estimates unless the deterministic evidence directly demonstrates them.",
      ],
    };
    this.cache.set(cacheKey, report);
    return report;
  }
}

function buildSecurityPackage(
  response: SecurityAuditResponse,
): AiEvidencePackage {
  return {
    subject: "security-audit",
    repository: repositoryIdentity(response.repository),
    deterministicSummary: response.report.securitySummary.overview,
    findings: response.findings.map((finding) => {
      const trace = requireFindingTrace(response, finding.id);
      return {
        findingId: finding.id,
        title: finding.title,
        category: finding.category,
        severity: finding.severity,
        confidence: finding.confidence,
        repositoryFile: trace.repositoryFile,
        lineNumbers: trace.lineNumbers,
        ruleId: finding.ruleId,
        description: finding.intelligence.explanation,
        impact: finding.intelligence.potentialImpact,
        evidenceIds: trace.evidenceIds,
        evidence: evidenceExcerpts(response, trace.evidenceIds),
        recommendations: recommendationTexts(response, finding.id),
      };
    }),
  };
}

function buildRootCausePackage(
  response: RootCauseInvestigationResponse,
): AiEvidencePackage {
  const trace = response.traceability.findings[0];
  if (!trace) {
    return {
      subject: "root-cause-investigation",
      repository: repositoryIdentity(response.repository),
      deterministicSummary: response.rootCause.summary,
      findings: [],
    };
  }

  return {
    subject: "root-cause-investigation",
    repository: repositoryIdentity(response.repository),
    deterministicSummary: response.rootCause.summary,
    findings: [
      {
        findingId: trace.findingId,
        title: response.rootCause.title,
        category: response.rootCause.category,
        severity: null,
        confidence: response.confidence.level,
        repositoryFile: trace.repositoryFile,
        lineNumbers: trace.lineNumbers,
        ruleId: trace.ruleId,
        description: response.rootCause.summary,
        impact: response.impact,
        evidenceIds: trace.evidenceIds,
        evidence: evidenceExcerpts(response, trace.evidenceIds),
        recommendations: recommendationTexts(response, trace.findingId),
      },
    ],
  };
}

function buildPlannerPackage(
  response: PlannerUnifiedResponse,
): AiEvidencePackage {
  const findings: AiFindingInput[] = [];
  if (response.securityAssessment) {
    findings.push(...buildSecurityPackage(response.securityAssessment).findings);
  }
  if (response.rootCauseInvestigation) {
    findings.push(
      ...buildRootCausePackage(response.rootCauseInvestigation).findings,
    );
  }

  return {
    subject: "planner",
    repository: repositoryIdentity(
      response.repositoryOverview.repository,
    ),
    deterministicSummary: [
      `Intent: ${response.requestSummary.intent}.`,
      `Services: ${response.servicesExecuted.join(", ")}.`,
      `Overall risk: ${response.overallRisk.rating}.`,
    ].join(" "),
    findings,
  };
}

function repositoryIdentity(repository: {
  readonly name: string;
  readonly owner: string;
  readonly commitSha: string;
}) {
  return {
    name: repository.name,
    owner: repository.owner,
    commitSha: repository.commitSha,
  };
}

function requireFindingTrace(
  response: SecurityAuditResponse,
  findingId: string,
) {
  const trace = response.traceability.findings.find(
    (item) => item.findingId === findingId,
  );
  if (!trace) {
    throw new Error(`Missing traceability for finding ${findingId}.`);
  }
  return trace;
}

function evidenceExcerpts(
  response:
    | SecurityAuditResponse
    | RootCauseInvestigationResponse,
  evidenceIds: readonly string[],
): readonly string[] {
  return response.traceability.evidence
    .filter((evidence) => evidenceIds.includes(evidence.evidenceId))
    .map((evidence) => evidence.excerpt);
}

function recommendationTexts(
  response:
    | SecurityAuditResponse
    | RootCauseInvestigationResponse,
  findingId: string,
): readonly string[] {
  return response.recommendations
    .filter((recommendation) =>
      recommendation.relatedFindingIds.includes(findingId),
    )
    .map((recommendation) => recommendation.text);
}

function insufficientEvidenceReport(): AiIntelligenceReport {
  const section = {
    content:
      "No deterministic findings were available, so Adam did not request AI reasoning.",
    findingIds: [],
  };
  return {
    status: "insufficient-evidence",
    provider: null,
    model: null,
    cacheHit: false,
    executiveSummary: section,
    developerSummary: section,
    businessImpact: section,
    attackNarrative: section,
    remediationStrategy: section,
    priorityRoadmap: section,
    architectureObservations: section,
    confidenceSummary: section,
    limitations: [
      "AI reasoning requires at least one deterministic finding.",
    ],
  };
}
