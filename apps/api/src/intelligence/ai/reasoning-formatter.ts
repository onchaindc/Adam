import type { AiReasoningSection } from "@adam/contracts";
import { z } from "zod";

import {
  AI_SECTION_KEYS,
  type AiFindingInput,
  type AiSectionKey,
} from "./types.js";

const sectionSchema = z
  .object({
    content: z.string().optional(),
    findingIds: z.array(z.string().min(1)).optional(),
  })
  .passthrough();

export type FormattedAiReasoning = Readonly<
  Record<AiSectionKey, AiReasoningSection>
>;

export class ReasoningFormatter {
  public format(
    outputText: string,
    findings: readonly AiFindingInput[],
  ): FormattedAiReasoning {
    let parsedJson: Record<string, unknown> = {};
    try {
      const candidate: unknown = JSON.parse(outputText);
      if (isRecord(candidate)) {
        parsedJson = candidate;
      }
    } catch {
      // A deterministic section is built below for every missing field.
    }

    const allowed = new Set(findings.map((finding) => finding.findingId));
    const repaired = {} as Record<AiSectionKey, AiReasoningSection>;

    for (const key of AI_SECTION_KEYS) {
      const parsedSection = sectionSchema.safeParse(parsedJson[key]);
      const section = parsedSection.success ? parsedSection.data : {};
      const suppliedIds = [...new Set(section.findingIds ?? [])];
      const containsUnknownReference = suppliedIds.some(
        (findingId) => !allowed.has(findingId),
      );
      const contentReferencesUnknownFinding = extractFindingIds(
        section.content ?? "",
      ).some((findingId) => !allowed.has(findingId));

      const findingIds =
        suppliedIds.length > 0 && !containsUnknownReference
          ? suppliedIds
          : selectFallbackFindings(findings).map(
              (finding) => finding.findingId,
            );
      const content =
        section.content?.trim() &&
        !containsUnknownReference &&
        !contentReferencesUnknownFinding
          ? section.content.trim()
          : buildDeterministicContent(key, findings, findingIds);

      repaired[key] = {
        content: appendMissingFindingIds(content, findingIds),
        findingIds,
      };
    }

    return repaired;
  }
}

function appendMissingFindingIds(
  content: string,
  findingIds: readonly string[],
): string {
  const missing = findingIds.filter(
    (findingId) => !content.includes(findingId),
  );
  if (missing.length === 0) {
    return content;
  }
  return `${content} Supporting findings: ${missing.join(", ")}.`;
}

function buildDeterministicContent(
  key: AiSectionKey,
  findings: readonly AiFindingInput[],
  findingIds: readonly string[],
): string {
  const selected = findingIds
    .map((findingId) =>
      findings.find((finding) => finding.findingId === findingId),
    )
    .filter((finding): finding is AiFindingInput => finding !== undefined);
  const references = selected
    .map((finding) => `${finding.findingId} (${finding.title})`)
    .join(", ");

  switch (key) {
    case "executiveSummary":
      return `Deterministic evidence identifies: ${references}.`;
    case "developerSummary":
      return selected
        .map(
          (finding) =>
            `${finding.findingId}: ${finding.description}${formatLocation(finding)}`,
        )
        .join(" ");
    case "businessImpact":
      return selected
        .map((finding) => `${finding.findingId}: ${finding.impact}`)
        .join(" ");
    case "attackNarrative":
      return `The supplied static evidence for ${references} does not by itself establish runtime reachability or a complete attack path.`;
    case "remediationStrategy":
      return selected
        .map(
          (finding) =>
            `${finding.findingId}: ${finding.recommendations.join(" ") || "Review the recorded evidence and apply a repository-specific corrective control."}`,
        )
        .join(" ");
    case "priorityRoadmap":
      return selected
        .map(
          (finding, index) =>
            `${index + 1}. Address ${finding.findingId} (${finding.title}).`,
        )
        .join(" ");
    case "architectureObservations":
      return selected
        .map(
          (finding) =>
            `${finding.findingId} is supported by rule ${finding.ruleId} in category ${finding.category}.`,
        )
        .join(" ");
    case "confidenceSummary":
      return selected
        .map(
          (finding) =>
            `${finding.findingId} has ${finding.confidence} deterministic confidence.`,
        )
        .join(" ");
  }
}

function selectFallbackFindings(
  findings: readonly AiFindingInput[],
): readonly AiFindingInput[] {
  return findings.slice(0, 3);
}

function formatLocation(finding: AiFindingInput): string {
  if (!finding.repositoryFile) {
    return ".";
  }
  const lines =
    finding.lineNumbers.length > 0
      ? `:${finding.lineNumbers.join(",")}`
      : "";
  return ` at ${finding.repositoryFile}${lines}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractFindingIds(content: string): readonly string[] {
  return content.match(/\bADAM-[A-Z]+(?:-[A-Z]+)*-\d{4}\b/g) ?? [];
}
