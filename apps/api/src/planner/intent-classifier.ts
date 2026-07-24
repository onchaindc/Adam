import type {
  DetectionConfidence,
  PlannerIntent,
  PlannerIntentClassification,
} from "@adam/contracts";

import type { IntentClassifier, IntentSignal } from "./types.js";

const securitySignals: readonly IntentSignal[] = [
  { name: "audit", pattern: /\baudit\b/i },
  { name: "vulnerability", pattern: /\bvulnerabilit(?:y|ies)\b/i },
  { name: "security", pattern: /\bsecurity\b/i },
  { name: "smart-contract-review", pattern: /\breview\b.*\bsmart contract\b/i },
  { name: "repository-scan", pattern: /\bscan\b.*\b(?:repo|repository|github)\b/i },
  { name: "code-review", pattern: /\bcheck\b.*\bcode\b.*\bsecurity\b/i },
];

const rootCauseSignals: readonly IntentSignal[] = [
  { name: "why-failing", pattern: /\bwhy\b.*\b(?:fail|failing|failed)\b/i },
  { name: "build-failure", pattern: /\bbuild\b.*\b(?:fail|error|broken)\b/i },
  { name: "deployment-crash", pattern: /\bdeployment\b.*\b(?:crash|fail|error)\b/i },
  { name: "runtime-error", pattern: /\bruntime\b.*\b(?:error|exception|crash)\b/i },
  { name: "stack-trace", pattern: /\bstack trace\b/i },
  { name: "exception", pattern: /\b(?:explain|investigate|fix)\b.*\bexception\b/i },
  { name: "investigate", pattern: /\binvestigat(?:e|ion)\b/i },
];

const combinedSignals: readonly IntentSignal[] = [
  {
    name: "hackathon-review",
    pattern: /\breview\b.*\bhackathon\b.*\b(?:submission|project)\b/i,
  },
  {
    name: "analyze-repository",
    pattern: /\banaly[sz]e\b.*\b(?:repo|repository|project)\b/i,
  },
  {
    name: "everything-wrong",
    pattern: /\beverything\b.*\bwrong\b.*\b(?:repo|repository|project)?\b/i,
  },
  {
    name: "audit-then-investigate",
    pattern: /\baudit\b.*\b(?:then|and)\b.*\b(?:explain|investigate|why)\b/i,
  },
  {
    name: "full-review",
    pattern: /\b(?:full|complete|comprehensive)\b.*\b(?:review|analysis)\b/i,
  },
];

export class DeterministicIntentClassifier implements IntentClassifier {
  public classify(request: string): PlannerIntentClassification {
    const normalized = request.trim();
    const securityMatches = matchSignals(normalized, securitySignals);
    const rootCauseMatches = matchSignals(normalized, rootCauseSignals);
    const combinedMatches = matchSignals(normalized, combinedSignals);

    if (
      combinedMatches.length > 0 ||
      (securityMatches.length > 0 && rootCauseMatches.length > 0)
    ) {
      return classification(
        "combined-analysis",
        [...combinedMatches, ...securityMatches, ...rootCauseMatches],
        "The request asks for broad project analysis or contains both security and failure-investigation signals.",
        combinedMatches.length > 0 ? "high" : "medium",
      );
    }
    if (rootCauseMatches.length > 0) {
      return classification(
        "root-cause-investigation",
        rootCauseMatches,
        "The request focuses on explaining a build, deployment, runtime, stack-trace, or exception failure.",
        confidenceFor(rootCauseMatches.length),
      );
    }
    if (securityMatches.length > 0) {
      return classification(
        "security-audit",
        securityMatches,
        "The request asks for security review, vulnerability discovery, or repository scanning.",
        confidenceFor(securityMatches.length),
      );
    }

    return classification(
      "repository-analysis",
      [],
      "No security or failure-investigation signal was present, so the planner selected repository intelligence only.",
      "low",
    );
  }
}

function matchSignals(
  request: string,
  signals: readonly IntentSignal[],
): readonly string[] {
  return signals
    .filter((signal) => signal.pattern.test(request))
    .map((signal) => signal.name);
}

function classification(
  intent: PlannerIntent,
  matchedSignals: readonly string[],
  rationale: string,
  confidence: DetectionConfidence,
): PlannerIntentClassification {
  return {
    intent,
    confidence,
    matchedSignals: [...new Set(matchedSignals)],
    rationale,
  };
}

function confidenceFor(matchCount: number): DetectionConfidence {
  return matchCount >= 2 ? "high" : "medium";
}
