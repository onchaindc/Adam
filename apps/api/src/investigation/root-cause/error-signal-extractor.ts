import type { SupportingLogEntry } from "@adam/contracts";

import type { ErrorSignal } from "./types.js";

const strongErrorPattern =
  /\b(?:fatal|panic|exception|unhandled|failed|failure|error|revert(?:ed)?|unauthorized|forbidden|econnrefused|enotfound|etimedout)\b/i;
const mediumErrorPattern =
  /\b(?:cannot|could not|missing|invalid|unsupported|not found|undefined|exited|crash|timeout|refused)\b/i;
const stackFramePattern =
  /^\s*(?:at\s+|File\s+"[^"]+",\s+line\s+\d+|[A-Za-z0-9_.]+\([^)]*:\d+\))/;

export function extractErrorSignals(
  entries: readonly SupportingLogEntry[],
): readonly ErrorSignal[] {
  const signals: ErrorSignal[] = [];

  for (const entry of entries) {
    const strength = signalStrength(entry.text);
    if (strength === 0) {
      continue;
    }

    signals.push({
      id: `SIGNAL-${String(signals.length + 1).padStart(5, "0")}`,
      entryId: entry.id,
      source: entry.source,
      line: entry.line,
      message: entry.text,
      strength,
    });
  }

  return signals;
}

function signalStrength(text: string): number {
  if (strongErrorPattern.test(text)) {
    return 3;
  }
  if (mediumErrorPattern.test(text)) {
    return 2;
  }
  if (stackFramePattern.test(text)) {
    return 1;
  }
  return 0;
}
