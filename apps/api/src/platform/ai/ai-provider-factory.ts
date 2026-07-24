import type { Environment } from "../../config/environment.js";
import type { AiReasoningProvider } from "../../intelligence/ai/types.js";
import { GeminiInteractionsProvider } from "./gemini-interactions-provider.js";
import { OpenAiResponsesProvider } from "./openai-responses-provider.js";

export function createAiReasoningProvider(
  environment: Environment,
): AiReasoningProvider | null {
  if (environment.AI_PROVIDER === "openai") {
    return environment.OPENAI_API_KEY
      ? new OpenAiResponsesProvider({
          apiKey: environment.OPENAI_API_KEY,
          model: environment.OPENAI_MODEL,
          timeoutMs: environment.AI_REQUEST_TIMEOUT_MS,
        })
      : null;
  }

  if (environment.AI_PROVIDER === "gemini") {
    const apiKey =
      environment.GOOGLE_API_KEY ?? environment.GEMINI_API_KEY;
    return apiKey
      ? new GeminiInteractionsProvider({
          apiKey,
          model: environment.GEMINI_MODEL,
          timeoutMs: environment.AI_REQUEST_TIMEOUT_MS,
        })
      : null;
  }

  return null;
}
