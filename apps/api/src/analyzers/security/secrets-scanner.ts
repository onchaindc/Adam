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

export interface SecretLineDetection {
  readonly ruleId: string;
  readonly title: string;
  readonly severity: SecurityFindingCandidate["severity"];
  readonly description: string;
  readonly confidence: SecurityFindingCandidate["confidence"];
}

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
    ruleId: "SEC-EVM-PRIVATE-KEY",
    title: "Likely EVM private key",
    pattern:
      /\b(?:private[_-]?key|wallet[_-]?(?:private[_-]?)?key|deployer[_-]?(?:private[_-]?)?key|signer[_-]?(?:private[_-]?)?key)\b["']?\s*[:=]\s*["']?(?:0x)?[a-f0-9]{64}\b/i,
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
      for (const detection of detectSecretsInLine(
        source.file.path,
        source.text,
      )) {
        findings.push({
          ruleId: detection.ruleId,
          category: this.category,
          title: detection.title,
          severity: detection.severity,
          file: source.file.path,
          line: source.line,
          description: detection.description,
          evidence: redactAssignment(source.text),
          confidence: detection.confidence,
        });
      }
    }

    return findings;
  }
}

export function detectSecretsInLine(
  path: string,
  text: string,
): readonly SecretLineDetection[] {
  if (isPlaceholderValue(text)) {
    return [];
  }

  const confidence = isLikelyTestOrExample(path) ? "medium" : "high";
  const detections: SecretLineDetection[] = [];
  for (const rule of secretRules) {
    if (rule.pattern.test(text)) {
      detections.push({
        ruleId: rule.ruleId,
        title: rule.title,
        severity: rule.severity,
        description:
          "A value matching a credential pattern is stored in source text.",
        confidence,
      });
    }
  }

  if (
    detections.length === 0 &&
    isPopulatedSensitiveEnvironmentAssignment(path, text)
  ) {
    detections.push({
          ruleId: "SEC-POPULATED-ENV-SECRET",
          title: "Populated sensitive environment value",
          severity: "high",
          description:
            "A committed environment file contains a non-placeholder value assigned to a sensitive variable name. The value may be test data, but it should be reviewed and removed or replaced with an empty placeholder.",
          confidence: "high",
    });
  }

  if (isMnemonicAssignment(text)) {
    detections.push({
      ruleId: "SEC-MNEMONIC",
      title: "Likely mnemonic phrase",
      severity: "critical",
      description:
        "A seed or mnemonic variable contains a likely recovery phrase.",
      confidence,
    });
  }

  return detections;
}

function isPlaceholderValue(text: string): boolean {
  return /(?:changeme|replace[_-]?me|your[_-]?(?:api[_-]?)?(?:key|token|secret)|example[_-]?(?:api[_-]?)?(?:key|token|secret))/i.test(
    text,
  );
}

function isPopulatedSensitiveEnvironmentAssignment(
  path: string,
  text: string,
): boolean {
  const filename = path.split("/").at(-1)?.toLowerCase() ?? "";
  if (filename !== ".env" && !filename.startsWith(".env.")) {
    return false;
  }

  const assignment =
    /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(
      text,
    );
  if (!assignment?.[1] || assignment[2] === undefined) {
    return false;
  }

  const name = assignment[1];
  const value = assignment[2].trim().replace(/^(['"])(.*)\1$/, "$2").trim();
  return (
    /(?:private[_-]?key|api[_-]?key|secret|token|password|passwd|pwd|mnemonic|seed[_-]?phrase)/i.test(
      name,
    ) &&
    value.length >= 8 &&
    !/^(?:0x)?0+$/.test(value) &&
    !/^<[^>]+>$/.test(value) &&
    !/^\$\{[^}]+\}$/.test(value)
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
