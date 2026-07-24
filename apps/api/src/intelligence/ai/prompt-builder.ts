import type { AiEvidencePackage, AiPrompt } from "./types.js";

export const AI_REASONING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "executiveSummary",
    "developerSummary",
    "businessImpact",
    "attackNarrative",
    "remediationStrategy",
    "priorityRoadmap",
    "architectureObservations",
    "confidenceSummary",
  ],
  properties: {
    executiveSummary: sectionSchema(),
    developerSummary: sectionSchema(),
    businessImpact: sectionSchema(),
    attackNarrative: sectionSchema(),
    remediationStrategy: sectionSchema(),
    priorityRoadmap: sectionSchema(),
    architectureObservations: sectionSchema(),
    confidenceSummary: sectionSchema(),
  },
} as const;

export class PromptBuilder {
  public build(evidencePackage: AiEvidencePackage): AiPrompt {
    return {
      instructions: [
        "You are Adam's evidence-constrained software security intelligence layer.",
        "Reason only about the deterministic findings in the supplied JSON.",
        "Never create a vulnerability, finding ID, evidence ID, file, line number, rule ID, or fact that is not present.",
        "If evidence is insufficient for exploitability, attack paths, business impact, or architecture claims, say that explicitly.",
        "Every section must include one or more supplied findingIds and must include those IDs verbatim in its content.",
        "Do not change deterministic severity, confidence, security score, or root-cause selection.",
        "Return only JSON matching the required schema.",
      ].join(" "),
      input: JSON.stringify(evidencePackage),
    };
  }
}

function sectionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["content", "findingIds"],
    properties: {
      content: {
        type: "string",
        minLength: 1,
      },
      findingIds: {
        type: "array",
        minItems: 1,
        uniqueItems: true,
        items: {
          type: "string",
        },
      },
    },
  } as const;
}
