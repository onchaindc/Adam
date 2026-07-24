import type {
  DetectionConfidence,
  SecuritySeverity,
} from "@adam/contracts";

import type { RepositoryModel } from "../../investigation/repository/model.js";
import {
  collectSourceLines,
  evidenceSnippet,
  isLikelyTestOrExample,
} from "./source-utils.js";
import type { SecurityFindingCandidate } from "./types.js";

interface LanguageSecurityRule {
  readonly ruleId: string;
  readonly extensions: readonly string[];
  readonly title: string;
  readonly severity: SecuritySeverity;
  readonly confidence: DetectionConfidence;
  readonly pattern: RegExp;
  readonly exclude?: RegExp;
  readonly description: string;
}

export const LANGUAGE_SECURITY_RULES: readonly LanguageSecurityRule[] = [
  rule(
    "LANG-RUST-UNSAFE-BLOCK",
    [".rs"],
    "Rust unsafe code",
    "medium",
    "high",
    /\bunsafe\s*(?:\{|fn\b|impl\b|trait\b)/,
    "Rust unsafe code bypasses compiler-enforced memory-safety guarantees.",
  ),
  rule(
    "LANG-RUST-UNWRAP-EXPECT",
    [".rs"],
    "Rust unwrap or expect may panic",
    "medium",
    "medium",
    /\.(?:unwrap|expect)\s*\(/,
    "unwrap or expect terminates execution when a Result or Option is unsuccessful.",
  ),
  rule(
    "LANG-RUST-PANIC",
    [".rs"],
    "Explicit Rust panic",
    "medium",
    "high",
    /\bpanic!\s*\(/,
    "An explicit panic can terminate the current task or process on a reachable input path.",
  ),
  rule(
    "LANG-GO-PANIC",
    [".go"],
    "Go panic usage",
    "medium",
    "high",
    /\bpanic\s*\(/,
    "panic can terminate normal control flow and crash a service when not recovered safely.",
  ),
  rule(
    "LANG-GO-IGNORED-ERROR",
    [".go"],
    "Ignored Go return value",
    "medium",
    "medium",
    /(?:^|[^\w])_\s*(?::=|=)\s*[A-Za-z_][\w.]*\s*\(/,
    "Discarding a function result can hide an error or partial failure.",
  ),
  rule(
    "LANG-GO-INSECURE-RANDOM",
    [".go"],
    "Non-cryptographic Go randomness",
    "high",
    "high",
    /["']math\/rand(?:\/v2)?["']/,
    "math/rand is predictable and is not suitable for tokens, secrets, or security decisions.",
  ),
  rule(
    "LANG-PYTHON-EXEC",
    [".py"],
    "Dynamic Python execution",
    "high",
    "high",
    /(?:^|[^\w.])exec\s*\(/,
    "Python exec executes text or compiled input as code.",
  ),
  rule(
    "LANG-PYTHON-SUBPROCESS-SHELL",
    [".py"],
    "Python subprocess shell execution",
    "high",
    "high",
    /\bsubprocess\.(?:run|Popen|call|check_call|check_output)\s*\([^#]*\bshell\s*=\s*True\b/,
    "shell=True routes command content through a shell and can enable command injection.",
  ),
  rule(
    "LANG-PYTHON-UNSAFE-YAML-LOAD",
    [".py"],
    "Unsafe Python YAML loading",
    "high",
    "high",
    /\byaml\.(?:unsafe_)?load\s*\(/,
    "Unsafe YAML loading can construct attacker-controlled Python objects.",
    /\b(?:SafeLoader|CSafeLoader|safe_load)\b/,
  ),
  rule(
    "LANG-JVM-OBJECT-DESERIALIZATION",
    [".java", ".kt", ".kts"],
    "JVM object deserialization",
    "high",
    "high",
    /\b(?:new\s+ObjectInputStream\s*\(|new\s+XMLDecoder\s*\(|new\s+XStream\s*\(|[A-Za-z_]\w*\.fromXML\s*\(|[A-Za-z_]\w*\.readObject\s*\()/,
    "Native or object-capable JVM deserialization can instantiate attacker-controlled types.",
  ),
  rule(
    "LANG-JVM-REFLECTION-ACCESS",
    [".java", ".kt", ".kts"],
    "JVM reflection access override",
    "medium",
    "high",
    /\b(?:setAccessible\s*\(\s*true\s*\)|isAccessible\s*=\s*true)\b/,
    "Overriding reflective access checks can bypass intended encapsulation and access controls.",
  ),
  rule(
    "LANG-JVM-SQL-CONCAT",
    [".java", ".kt", ".kts"],
    "Dynamically concatenated SQL",
    "high",
    "medium",
    /\bexecute(?:Query|Update|LargeUpdate)?\s*\([^)]*(?:\+|\$\{?\w+)/,
    "SQL built through concatenation or interpolation can permit injection when values are untrusted.",
  ),
  rule(
    "LANG-PHP-DYNAMIC-INCLUDE",
    [".php"],
    "Dynamic PHP include or require",
    "high",
    "medium",
    /\b(?:include|include_once|require|require_once)\s*(?:\(|\s)\s*\$/,
    "A variable include path can load unintended local or remote PHP content.",
  ),
  rule(
    "LANG-PHP-COMMAND-EXECUTION",
    [".php"],
    "PHP command execution with variable input",
    "high",
    "medium",
    /\b(?:exec|system|shell_exec|passthru|popen|proc_open)\s*\([^)]*\$/,
    "A command-execution function receives variable input that may require strict validation.",
  ),
  rule(
    "LANG-C-DANGEROUS-STRING",
    [".c", ".h", ".cc", ".cpp", ".cxx", ".hh", ".hpp", ".hxx"],
    "Dangerous C string operation",
    "high",
    "high",
    /\b(?:strcpy|strcat|sprintf|vsprintf)\s*\(/,
    "The operation does not enforce the destination-buffer capacity.",
  ),
  rule(
    "LANG-C-UNBOUNDED-INPUT",
    [".c", ".h", ".cc", ".cpp", ".cxx", ".hh", ".hpp", ".hxx"],
    "Unbounded C input operation",
    "high",
    "high",
    /\b(?:gets\s*\(|scanf\s*\(\s*["'][^"']*%s)/,
    "The input operation can write beyond a fixed buffer when input length is not bounded.",
  ),
  rule(
    "LANG-C-MEMORY-SIZE-OVERFLOW",
    [".c", ".h", ".cc", ".cpp", ".cxx", ".hh", ".hpp", ".hxx"],
    "Unchecked allocation size multiplication",
    "medium",
    "medium",
    /\b(?:malloc|realloc)\s*\([^)]*\*[^)]*\)/,
    "Allocation-size multiplication can wrap before allocation if operands are not bounded.",
  ),
  rule(
    "LANG-CSHARP-INSECURE-DESERIALIZATION",
    [".cs"],
    "Insecure .NET deserialization",
    "high",
    "high",
    /\b(?:BinaryFormatter|NetDataContractSerializer|LosFormatter|ObjectStateFormatter|JavaScriptSerializer)\b/,
    "The deserializer can materialize attacker-selected object graphs or unsafe types.",
  ),
  rule(
    "LANG-CSHARP-REFLECTION-LOAD",
    [".cs"],
    "Dynamic .NET assembly loading",
    "high",
    "medium",
    /\b(?:Assembly|AppDomain\.CurrentDomain)\.(?:Load|LoadFrom|LoadFile)\s*\(/,
    "Dynamic assembly loading can execute untrusted code when the source is not fixed and authenticated.",
  ),
  rule(
    "LANG-CSHARP-UNSAFE-CODE",
    [".cs"],
    "C# unsafe code",
    "medium",
    "high",
    /\bunsafe\s+(?:class|struct|interface|delegate|static|void|[A-Za-z_]\w*)|\bunsafe\s*\{/,
    "C# unsafe code permits pointer operations outside normal managed-memory guarantees.",
  ),
  rule(
    "LANG-SWIFT-SENSITIVE-USERDEFAULTS",
    [".swift"],
    "Sensitive Swift data stored in UserDefaults",
    "medium",
    "medium",
    /\bUserDefaults(?:\.standard)?\.set\s*\([^)]*(?:password|token|secret|apiKey|privateKey)/i,
    "UserDefaults is not a secure secret store for credentials or sensitive key material.",
  ),
  rule(
    "LANG-SWIFT-FORCE-UNWRAP",
    [".swift"],
    "Swift force unwrap",
    "low",
    "medium",
    /\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*!(?!=)/,
    "Force-unwrapping an absent optional raises a runtime trap.",
  ),
  rule(
    "LANG-SWIFT-WEAK-TLS",
    [".swift"],
    "Weak Swift TLS trust handling",
    "high",
    "high",
    /\b(?:allowsAnyHTTPSCertificate|SecTrustSetExceptions)\b/,
    "The trust override can accept certificates that normal TLS validation would reject.",
  ),
] as const;

export function inspectLanguageSecurityPatterns(
  model: RepositoryModel,
): readonly SecurityFindingCandidate[] {
  const findings: SecurityFindingCandidate[] = [];
  const sourceLines = collectSourceLines(model.files);

  for (const source of sourceLines) {
    const extension = source.file.extension.toLowerCase();
    for (const languageRule of LANGUAGE_SECURITY_RULES) {
      if (
        !languageRule.extensions.includes(extension) ||
        !languageRule.pattern.test(source.text) ||
        languageRule.exclude?.test(source.text)
      ) {
        continue;
      }
      findings.push(toFinding(languageRule, source.file.path, source.line, source.text));
    }
  }

  for (const file of model.files) {
    if (file.extension.toLowerCase() !== ".go" || file.content === null) {
      continue;
    }
    const lines = file.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines[index] ?? "";
      if (!/\bgo\s+(?:func\s*\(|[A-Za-z_][\w.]*\s*\()/.test(text)) {
        continue;
      }
      const context = lines
        .slice(Math.max(0, index - 3), index + 1)
        .join(" ");
      if (!/\bfor\b|\brange\b/.test(context)) {
        continue;
      }
      findings.push({
        ruleId: "LANG-GO-GOROUTINE-IN-LOOP",
        category: "static-pattern",
        title: "Goroutine launched from a loop",
        severity: "medium",
        file: file.path,
        line: index + 1,
        description:
          "Launching goroutines from a loop can create unbounded concurrent work without cancellation or backpressure.",
        evidence: evidenceSnippet(text),
        confidence: isLikelyTestOrExample(file.path) ? "low" : "medium",
      });
    }
  }

  return findings;
}

function rule(
  ruleId: string,
  extensions: readonly string[],
  title: string,
  severity: SecuritySeverity,
  confidence: DetectionConfidence,
  pattern: RegExp,
  description: string,
  exclude?: RegExp,
): LanguageSecurityRule {
  return {
    ruleId,
    extensions,
    title,
    severity,
    confidence,
    pattern,
    description,
    ...(exclude ? { exclude } : {}),
  };
}

function toFinding(
  languageRule: LanguageSecurityRule,
  file: string,
  line: number,
  text: string,
): SecurityFindingCandidate {
  return {
    ruleId: languageRule.ruleId,
    category: "static-pattern",
    title: languageRule.title,
    severity: languageRule.severity,
    file,
    line,
    description: languageRule.description,
    evidence: evidenceSnippet(text),
    confidence: isLikelyTestOrExample(file)
      ? "low"
      : languageRule.confidence,
  };
}
