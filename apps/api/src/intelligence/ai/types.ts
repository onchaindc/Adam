import type { DetectionConfidence } from "@adam/contracts";

export const AI_SECTION_KEYS = [
  "executiveSummary",
  "developerSummary",
  "businessImpact",
  "attackNarrative",
  "remediationStrategy",
  "priorityRoadmap",
  "architectureObservations",
  "confidenceSummary",
] as const;

export type AiSectionKey = (typeof AI_SECTION_KEYS)[number];

export interface AiFindingInput {
  readonly findingId: string;
  readonly title: string;
  readonly category: string;
  readonly severity: string | null;
  readonly confidence: DetectionConfidence;
  readonly repositoryFile: string | null;
  readonly lineNumbers: readonly number[];
  readonly ruleId: string;
  readonly description: string;
  readonly impact: string;
  readonly evidenceIds: readonly string[];
  readonly evidence: readonly string[];
  readonly recommendations: readonly string[];
}

export interface AiEvidencePackage {
  readonly subject: "security-audit" | "root-cause-investigation" | "planner";
  readonly repository: {
    readonly name: string;
    readonly owner: string;
    readonly commitSha: string;
  };
  readonly deterministicSummary: string;
  readonly findings: readonly AiFindingInput[];
}

export interface AiPrompt {
  readonly instructions: string;
  readonly input: string;
}

export interface AiReasoningProviderResult {
  readonly provider: "openai";
  readonly model: string;
  readonly outputText: string;
}

export interface AiReasoningProvider {
  generate(prompt: AiPrompt): Promise<AiReasoningProviderResult>;
}
