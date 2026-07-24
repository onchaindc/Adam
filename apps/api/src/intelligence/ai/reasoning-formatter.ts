import type { AiReasoningSection } from "@adam/contracts";
import { z } from "zod";

import { AiIntelligenceError } from "./errors.js";
import { AI_SECTION_KEYS, type AiSectionKey } from "./types.js";

const sectionSchema = z
  .object({
    content: z.string().min(1),
    findingIds: z.array(z.string().min(1)).min(1),
  })
  .strict();

const responseSchema = z
  .object(
    Object.fromEntries(
      AI_SECTION_KEYS.map((key) => [key, sectionSchema]),
    ) as Record<AiSectionKey, typeof sectionSchema>,
  )
  .strict();

export type FormattedAiReasoning = Readonly<
  Record<AiSectionKey, AiReasoningSection>
>;

export class ReasoningFormatter {
  public format(
    outputText: string,
    allowedFindingIds: readonly string[],
  ): FormattedAiReasoning {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(outputText);
    } catch (error) {
      throw new AiIntelligenceError(
        "ai-output-invalid",
        "The AI provider returned invalid JSON.",
        { cause: error },
      );
    }

    const parsed = responseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new AiIntelligenceError(
        "ai-output-invalid",
        "The AI provider response did not match the required reasoning schema.",
        { cause: parsed.error },
      );
    }

    const allowed = new Set(allowedFindingIds);
    for (const key of AI_SECTION_KEYS) {
      const section = parsed.data[key];
      for (const findingId of section.findingIds) {
        if (!allowed.has(findingId)) {
          throw new AiIntelligenceError(
            "ai-output-invalid",
            `The AI provider referenced unknown finding ${findingId}.`,
          );
        }
        if (!section.content.includes(findingId)) {
          throw new AiIntelligenceError(
            "ai-output-invalid",
            `${key} did not include its supporting finding ID in the content.`,
          );
        }
      }
    }

    return parsed.data;
  }
}
