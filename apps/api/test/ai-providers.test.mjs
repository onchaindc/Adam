import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadEnvironment } from "../dist/config/environment.js";
import { AiIntelligenceError } from "../dist/intelligence/ai/errors.js";
import { GeminiInteractionsProvider } from "../dist/platform/ai/gemini-interactions-provider.js";
import { createAiReasoningProvider } from "../dist/platform/ai/ai-provider-factory.js";
import { OpenAiResponsesProvider } from "../dist/platform/ai/openai-responses-provider.js";
import { requireAiIntelligence } from "../dist/services/analysis-mode.js";
import { createErrorHandler } from "../dist/transport/http/error-handler.js";

describe("AI provider selection", () => {
  it("selects OpenAI or Gemini from environment variables", () => {
    const openAi = createAiReasoningProvider(
      loadEnvironment({
        NODE_ENV: "test",
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "openai-test-key",
      }),
    );
    const gemini = createAiReasoningProvider(
      loadEnvironment({
        NODE_ENV: "test",
        AI_PROVIDER: "gemini",
        GEMINI_API_KEY: "gemini-test-key",
      }),
    );
    const googleAlias = createAiReasoningProvider(
      loadEnvironment({
        NODE_ENV: "test",
        AI_PROVIDER: "gemini",
        GOOGLE_API_KEY: "google-test-key",
      }),
    );

    assert.equal(openAi instanceof OpenAiResponsesProvider, true);
    assert.equal(gemini instanceof GeminiInteractionsProvider, true);
    assert.equal(googleAlias instanceof GeminiInteractionsProvider, true);
  });

  it("fails closed with HTTP 503 when selected credentials are absent", () => {
    for (const providerName of ["openai", "gemini"]) {
      const provider = createAiReasoningProvider(
        loadEnvironment({
          NODE_ENV: "test",
          AI_PROVIDER: providerName,
        }),
      );
      assert.equal(provider, null);

      let error;
      try {
        requireAiIntelligence(provider);
      } catch (caught) {
        error = caught;
      }
      assert.equal(error instanceof AiIntelligenceError, true);
      assert.equal(error.code, "ai-not-configured");

      const result = captureErrorResponse(error);
      assert.equal(result.status, 503);
      assert.equal(result.body.error, "ai-not-configured");
    }
  });

  it("sends structured evidence reasoning through Gemini Interactions", async () => {
    let requestUrl;
    let requestOptions;
    const outputText = JSON.stringify({
      executiveSummary: {
        content: "Executive references ADAM-SEC-0001.",
        findingIds: ["ADAM-SEC-0001"],
      },
    });
    const provider = new GeminiInteractionsProvider({
      apiKey: "gemini-test-key",
      model: "gemini-test-model",
      timeoutMs: 5_000,
      fetchImplementation: async (url, options) => {
        requestUrl = String(url);
        requestOptions = options;
        return new Response(
          JSON.stringify({
            steps: [
              {
                type: "model_output",
                content: [{ type: "text", text: outputText }],
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
    });

    const result = await provider.generate({
      instructions: "Use evidence only.",
      input: "{\"findings\":[]}",
    });
    const body = JSON.parse(requestOptions.body);
    const serializedSchema = JSON.stringify(body.response_format.schema);

    assert.equal(
      requestUrl,
      "https://generativelanguage.googleapis.com/v1/interactions",
    );
    assert.equal(requestOptions.method, "POST");
    assert.equal(
      requestOptions.headers["x-goog-api-key"],
      "gemini-test-key",
    );
    assert.equal(body.model, "gemini-test-model");
    assert.equal(body.system_instruction, "Use evidence only.");
    assert.equal(body.store, false);
    assert.deepEqual(body.response_format.type, "text");
    assert.deepEqual(body.response_format.mime_type, "application/json");
    assert.equal(serializedSchema.includes("uniqueItems"), false);
    assert.equal(serializedSchema.includes("minLength"), false);
    assert.deepEqual(result, {
      provider: "gemini",
      model: "gemini-test-model",
      outputText,
    });
  });
});

function captureErrorResponse(error) {
  const result = { status: null, body: null };
  const response = {
    status(value) {
      result.status = value;
      return this;
    },
    json(value) {
      result.body = value;
      return this;
    },
  };
  createErrorHandler({ error() {} })(
    error,
    {
      requestId: "provider-test",
      method: "POST",
      path: "/audit",
    },
    response,
    () => {},
  );
  return result;
}
