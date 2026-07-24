import { AiIntelligenceError } from "../../intelligence/ai/errors.js";
import { AI_REASONING_JSON_SCHEMA } from "../../intelligence/ai/prompt-builder.js";
import type {
  AiPrompt,
  AiReasoningProvider,
  AiReasoningProviderResult,
} from "../../intelligence/ai/types.js";

interface GeminiInteractionsProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly fetchImplementation?: typeof fetch;
}

export class GeminiInteractionsProvider implements AiReasoningProvider {
  private readonly fetchImplementation: typeof fetch;

  public constructor(
    private readonly options: GeminiInteractionsProviderOptions,
  ) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  public async generate(
    prompt: AiPrompt,
  ): Promise<AiReasoningProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await this.fetchImplementation(
        "https://generativelanguage.googleapis.com/v1/interactions",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": this.options.apiKey,
          },
          body: JSON.stringify({
            model: this.options.model,
            input: prompt.input,
            system_instruction: prompt.instructions,
            store: false,
            response_format: {
              type: "text",
              mime_type: "application/json",
              schema: toGeminiSchema(AI_REASONING_JSON_SCHEMA),
            },
          }),
          signal: controller.signal,
        },
      );
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new AiIntelligenceError(
          "ai-provider-failure",
          `The AI provider request failed with status ${response.status}.`,
        );
      }
      const outputText = extractOutputText(payload);
      if (!outputText) {
        throw new AiIntelligenceError(
          "ai-provider-failure",
          "The AI provider response did not contain output text.",
        );
      }

      return {
        provider: "gemini",
        model: this.options.model,
        outputText,
      };
    } catch (error) {
      if (error instanceof AiIntelligenceError) {
        throw error;
      }
      throw new AiIntelligenceError(
        "ai-provider-failure",
        error instanceof Error && error.name === "AbortError"
          ? "The AI provider request timed out."
          : "The AI provider request failed.",
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractOutputText(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }
  if (typeof payload.output_text === "string") {
    return payload.output_text.length > 0 ? payload.output_text : null;
  }
  if (!Array.isArray(payload.steps)) {
    return null;
  }

  const text = payload.steps
    .filter((step) => isRecord(step) && step.type === "model_output")
    .flatMap((step) =>
      isRecord(step) && Array.isArray(step.content) ? step.content : [],
    )
    .filter(
      (content) =>
        isRecord(content) &&
        content.type === "text" &&
        typeof content.text === "string",
    )
    .map((content) => (content as { readonly text: string }).text)
    .join("");

  return text.length > 0 ? text : null;
}

function toGeminiSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(toGeminiSchema);
  }
  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "minLength" && key !== "uniqueItems")
      .map(([key, entry]) => [key, toGeminiSchema(entry)]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
