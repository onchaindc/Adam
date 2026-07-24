import type { SupportingLogEntry } from "@adam/contracts";

import type { InvestigationLogInput } from "./types.js";

const ansiPattern = /\u001b\[[0-9;]*m/g;
const timestampPattern =
  /^\s*(?:\[)?(\d{4}-\d{2}-\d{2}[T ][0-9:.+-]+Z?)(?:\])?\s*/;

export class LogNormalizer {
  public constructor(private readonly maxLines: number) {}

  public normalize(
    logs: readonly InvestigationLogInput[],
  ): {
    readonly entries: readonly SupportingLogEntry[];
    readonly truncated: boolean;
  } {
    const entries: SupportingLogEntry[] = [];

    for (const [logIndex, log] of logs.entries()) {
      const lines = log.content.replace(/\r\n?/g, "\n").split("\n");
      for (const [lineIndex, rawLine] of lines.entries()) {
        const cleanLine = redactSensitiveText(
          rawLine.replace(ansiPattern, "").trimEnd(),
        );
        if (cleanLine.trim().length === 0) {
          continue;
        }

        const timestampMatch = timestampPattern.exec(cleanLine);
        entries.push({
          id: `LOG-${String(entries.length + 1).padStart(5, "0")}`,
          source: log.source,
          label: log.label?.trim() || null,
          line: lineIndex + 1,
          timestamp: timestampMatch?.[1] ?? null,
          text: cleanLine,
        });

        if (entries.length >= this.maxLines) {
          return { entries, truncated: true };
        }
      }

      if (logIndex === logs.length - 1) {
        break;
      }
    }

    return { entries, truncated: false };
  }
}

function redactSensitiveText(text: string): string {
  return text
    .replace(
      /\b(Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
      "$1 [REDACTED]",
    )
    .replace(
      /\b(api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|pwd|secret)\b(\s*[:=]\s*)[^\s,;]+/gi,
      "$1$2[REDACTED]",
    )
    .replace(
      /\b(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi,
      "$1[REDACTED]@",
    )
    .replace(
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
      "[REDACTED PRIVATE KEY]",
    );
}
