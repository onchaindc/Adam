import type { RepositoryModel } from "../../investigation/repository/model.js";
import {
  collectSourceLines,
  evidenceSnippet,
  isLikelyTestOrExample,
} from "./source-utils.js";
import type {
  SecurityFindingCandidate,
  SecurityInspector,
} from "./types.js";

const configurationRules = [
  {
    ruleId: "CFG-TLS-VERIFY-DISABLED",
    title: "TLS verification disabled",
    severity: "high",
    pattern: /NODE_TLS_REJECT_UNAUTHORIZED\s*[:=]\s*["']?0["']?/,
    description: "The configuration disables TLS certificate verification.",
  },
  {
    ruleId: "CFG-CORS-WILDCARD",
    title: "Wildcard CORS origin",
    severity: "medium",
    pattern: /\borigin\s*:\s*["']\*["']/,
    description: "Cross-origin access is configured for every origin.",
  },
  {
    ruleId: "CFG-DEBUG-ENABLED",
    title: "Debug mode enabled",
    severity: "medium",
    pattern: /\b(?:DEBUG|debug)\s*[:=]\s*(?:true|["']true["'])/,
    description: "Debug behavior is enabled in committed configuration.",
  },
  {
    ruleId: "CFG-COOKIE-HTTPONLY-DISABLED",
    title: "HttpOnly cookie protection disabled",
    severity: "medium",
    pattern: /\bhttpOnly\s*:\s*false/,
    description: "A cookie is configured without HttpOnly protection.",
  },
  {
    ruleId: "CFG-DATABASE-SSL-DISABLED",
    title: "Database TLS disabled",
    severity: "high",
    pattern: /\bssl\s*:\s*(?:false|["']disable["'])/,
    description: "A database or network client configuration disables TLS.",
  },
] as const;

export class ConfigurationInspector implements SecurityInspector {
  public readonly category = "configuration" as const;

  public inspect(model: RepositoryModel): readonly SecurityFindingCandidate[] {
    const configurationPaths = new Set([
      ...model.summary.configurationFiles,
      ...model.summary.environmentFiles,
    ]);
    const findings: SecurityFindingCandidate[] = [];

    for (const source of collectSourceLines(model.files)) {
      if (
        !configurationPaths.has(source.file.path) &&
        !isConfigurationSource(source.file.path)
      ) {
        continue;
      }

      for (const rule of configurationRules) {
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
          description: rule.description,
          evidence: evidenceSnippet(source.text),
          confidence: isLikelyTestOrExample(source.file.path)
            ? "low"
            : "high",
        });
      }
    }

    return findings;
  }
}

function isConfigurationSource(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return (
    lowerPath.includes("/config/") ||
    lowerPath.startsWith("config/") ||
    lowerPath.endsWith("config.js") ||
    lowerPath.endsWith("config.ts")
  );
}
