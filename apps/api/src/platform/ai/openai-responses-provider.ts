import { AiIntelligenceError } from "../../intelligence/ai/errors.js";
import { AI_REASONING_JSON_SCHEMA } from "../../intelligence/ai/prompt-builder.js";
import type {
  AiPrompt,
  AiReasoningProvider,
  AiReasoningProviderResult,
} from "../../intelligence/ai/types.js";

interface OpenAiResponsesProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly timeoutMs: number;
}

export class OpenAiResponsesProvider implements AiReasoningProvider {
  public constructor(private readonly options: OpenAiResponsesProviderOptions) {}

  public async generate(
    prompt: AiPrompt,
  ): Promise<AiReasoningProviderResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          instructions: prompt.instructions,
          input: prompt.input,
          store: false,
          text: {
            format: {
              type: "json_schema",
              name: "adam_evidence_intelligence",
              strict: true,
              schema: AI_REASONING_JSON_SCHEMA,
            },
          },
        }),
        signal: controller.signal,
      });
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
        provider: "openai",
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
  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    return null;
  }

  const text = payload.output
    .flatMap((item) =>
      isRecord(item) && Array.isArray(item.content) ? item.content : [],
    )
    .filter(
      (content) =>
        isRecord(content) &&
        content.type === "output_text" &&
        typeof content.text === "string",
    )
    .map((content) => (content as { readonly text: string }).text)
    .join("");

  return text.length > 0 ? text : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
