import type { AiIntelligenceEngine } from "../intelligence/ai/ai-intelligence-engine.js";
import { AiIntelligenceError } from "../intelligence/ai/errors.js";

export function requireAiIntelligence(
  engine: AiIntelligenceEngine | null,
): AiIntelligenceEngine {
  if (!engine) {
    throw new AiIntelligenceError(
      "ai-not-configured",
      "Intelligent analysis is not configured.",
    );
  }
  return engine;
}
