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

const staticRules = [
  {
    ruleId: "STATIC-EVAL",
    title: "Dynamic code evaluation",
    severity: "high",
    pattern: /(?:^|[^\w.])eval\s*\(/,
    description: "Source text is executed dynamically with eval.",
  },
  {
    ruleId: "STATIC-FUNCTION-CONSTRUCTOR",
    title: "Dynamic Function construction",
    severity: "high",
    pattern: /\bnew\s+Function\s*\(/,
    description: "Source text is compiled dynamically with the Function constructor.",
  },
  {
    ruleId: "STATIC-CHILD-PROCESS-EXEC",
    title: "Shell command execution",
    severity: "high",
    pattern: /\b(?:exec|execSync)\s*\(/,
    description: "The application executes a command through a system shell.",
  },
  {
    ruleId: "STATIC-SPAWN-SHELL",
    title: "Child process with shell enabled",
    severity: "high",
    pattern: /\bshell\s*:\s*true/,
    description: "A child process is configured to execute through a shell.",
  },
  {
    ruleId: "STATIC-DANGEROUS-SHELL-COMMAND",
    title: "Dangerous shell command",
    severity: "critical",
    pattern:
      /\b(?:rm\s+-rf|chmod\s+777|curl\b[^|]*\|\s*(?:sh|bash)|wget\b[^|]*\|\s*(?:sh|bash))\b/i,
    description: "The command can delete data, weaken permissions, or execute remote content.",
  },
  {
    ruleId: "STATIC-NODE-UNSERIALIZE",
    title: "Unsafe JavaScript deserialization",
    severity: "critical",
    pattern: /\b(?:serialize|nodeSerialize)\.unserialize\s*\(/,
    description: "Untrusted serialized JavaScript may execute code during deserialization.",
  },
  {
    ruleId: "STATIC-PYTHON-PICKLE",
    title: "Unsafe Python deserialization",
    severity: "high",
    pattern: /\bpickle\.(?:load|loads)\s*\(/,
    description: "Python pickle can execute attacker-controlled objects during loading.",
  },
  {
    ruleId: "STATIC-PHP-UNSERIALIZE",
    title: "Unsafe PHP deserialization",
    severity: "high",
    pattern: /\bunserialize\s*\(/,
    description: "PHP unserialize can instantiate attacker-controlled object graphs.",
  },
] as const;

export class StaticSecurityPatternInspector implements SecurityInspector {
  public readonly category = "static-pattern" as const;

  public inspect(model: RepositoryModel): readonly SecurityFindingCandidate[] {
    const findings: SecurityFindingCandidate[] = [];

    for (const source of collectSourceLines(model.files)) {
      for (const rule of staticRules) {
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
            : rule.ruleId === "STATIC-CHILD-PROCESS-EXEC"
              ? "medium"
              : "high",
        });
      }
    }

    return findings;
  }
}
