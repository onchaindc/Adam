import type { RepositoryModel } from "../../investigation/repository/model.js";
import {
  collectSourceLines,
  isLikelyTestOrExample,
  redactAssignment,
} from "./source-utils.js";
import type {
  SecurityFindingCandidate,
  SecurityInspector,
} from "./types.js";

const secretRules = [
  {
    ruleId: "SEC-AWS-ACCESS-KEY",
    title: "Likely AWS access key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
    severity: "critical",
  },
  {
    ruleId: "SEC-GITHUB-TOKEN",
    title: "Likely GitHub access token",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    severity: "critical",
  },
  {
    ruleId: "SEC-API-TOKEN",
    title: "Likely API token",
    pattern: /\b(?:sk|pk)-[A-Za-z0-9_-]{20,}\b/,
    severity: "high",
  },
  {
    ruleId: "SEC-PRIVATE-KEY",
    title: "Private key material",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    severity: "critical",
  },
  {
    ruleId: "SEC-HARDCODED-CREDENTIAL",
    title: "Hardcoded credential",
    pattern:
      /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|pwd|secret)\b\s*[:=]\s*["'][^"'\s]{8,}["']/i,
    severity: "high",
  },
  {
    ruleId: "SEC-CREDENTIAL-URL",
    title: "Credential embedded in URL",
    pattern: /\bhttps?:\/\/[^/\s:@]+:[^/\s@]+@/i,
    severity: "high",
  },
] as const;

export class SecretsScanner implements SecurityInspector {
  public readonly category = "secrets" as const;

  public inspect(model: RepositoryModel): readonly SecurityFindingCandidate[] {
    const findings: SecurityFindingCandidate[] = [];

    for (const source of collectSourceLines(model.files)) {
      if (shouldSkipSource(source.file.path, source.text)) {
        continue;
      }

      for (const rule of secretRules) {
        if (!rule.pattern.test(source.text)) {
          continue;
        }

        findings.push({
          ruleId: rule.ruleId,
          category: this.category,
          title: rule.title,
          severity: rule.severity,
          file: source.file.path,
          line: source.line,
          description: "A value matching a credential pattern is stored in source text.",
          evidence: redactAssignment(source.text),
          confidence: isLikelyTestOrExample(source.file.path) ? "medium" : "high",
        });
      }

      if (isMnemonicAssignment(source.text)) {
        findings.push({
          ruleId: "SEC-MNEMONIC",
          category: this.category,
          title: "Likely mnemonic phrase",
          severity: "critical",
          file: source.file.path,
          line: source.line,
          description: "A seed or mnemonic variable contains a likely recovery phrase.",
          evidence: redactAssignment(source.text),
          confidence: isLikelyTestOrExample(source.file.path) ? "medium" : "high",
        });
      }
    }

    return findings;
  }
}

function shouldSkipSource(path: string, text: string): boolean {
  const lowerPath = path.toLowerCase();
  if (
    lowerPath.endsWith(".env.example") ||
    lowerPath.endsWith(".env.sample") ||
    lowerPath.endsWith(".env.template")
  ) {
    return true;
  }

  return /(?:changeme|replace[_-]?me|your[_-]?(?:key|token|secret)|example[_-]?(?:key|token|secret))/i.test(
    text,
  );
}

function isMnemonicAssignment(text: string): boolean {
  const match =
    /\b(?:mnemonic|seed[_-]?phrase|recovery[_-]?phrase)\b\s*[:=]\s*["']([^"']+)["']/i.exec(
      text,
    );
  if (!match?.[1]) {
    return false;
  }

  const words = match[1].trim().split(/\s+/);
  return (words.length === 12 || words.length === 24) &&
    words.every((word) => /^[a-z]+$/i.test(word));
}
