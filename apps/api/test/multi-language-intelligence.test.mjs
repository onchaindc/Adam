import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { StaticSecurityPatternInspector } from "../dist/analyzers/security/static-security-pattern-inspector.js";
import { SecurityAuditEngine } from "../dist/analyzers/security/security-audit-engine.js";
import { SecurityIntelligenceEngine } from "../dist/intelligence/security/security-intelligence-engine.js";
import { RepositoryScanner } from "../dist/investigation/repository/repository-scanner.js";
import { analyzeSecurityModel } from "../dist/services/security-model-analysis.js";
import { EvidenceLinkResolver } from "../dist/traceability/evidence-link-resolver.js";
import { EvidenceTraceabilityEngine } from "../dist/traceability/evidence-traceability-engine.js";

const fixtureDirectory = fileURLToPath(
  new URL("./fixtures/multi-language/", import.meta.url),
);

describe("Sprint 8 multi-language intelligence", () => {
  it("detects every supported language with evidence and framework context", async () => {
    const model = await scanFixture();
    const languages = new Map(
      model.summary.languages.map((language) => [language.name, language]),
    );

    for (const languageName of [
      "Rust",
      "Go",
      "Python",
      "Java",
      "Kotlin",
      "Swift",
      "C",
      "C++",
      "C#",
      "PHP",
    ]) {
      const language = languages.get(languageName);
      assert.ok(language, languageName);
      assert.equal(language.fileCount > 0, true, languageName);
      assert.equal(["high", "medium"].includes(language.confidence), true);
      assert.equal(language.evidence.length > 0, true, languageName);
    }

    const frameworkNames = new Set(
      model.summary.frameworks.map((framework) => framework.name),
    );
    for (const frameworkName of [
      "Actix Web",
      "Gin",
      "FastAPI",
      "Spring Boot",
      "Ktor",
      "Vapor",
      "SwiftUI",
      "CMake",
      "Boost",
      "ASP.NET Core",
      "Entity Framework Core",
      "Laravel",
    ]) {
      assert.equal(frameworkNames.has(frameworkName), true, frameworkName);
    }

    assert.match(
      model.summary.limitations.join(" "),
      /Multiple package-manager or dependency-manager files detected/,
    );
  });

  it("returns traceable language findings through the existing audit workflow", async () => {
    const model = await scanFixture();
    const response = analyzeSecurityModel({
      requestId: "multi-language-fixture",
      model,
      analysisMode: "deterministic",
      engine: new SecurityAuditEngine([
        new StaticSecurityPatternInspector(),
      ]),
      intelligence: new SecurityIntelligenceEngine(),
      traceability: new EvidenceTraceabilityEngine(
        new EvidenceLinkResolver(),
      ),
    });
    const rules = new Set(
      response.findings.map((finding) => finding.ruleId),
    );

    for (const expectedRule of [
      "LANG-RUST-UNSAFE-BLOCK",
      "LANG-GO-INSECURE-RANDOM",
      "LANG-GO-GOROUTINE-IN-LOOP",
      "LANG-PYTHON-EXEC",
      "LANG-PYTHON-SUBPROCESS-SHELL",
      "LANG-PYTHON-UNSAFE-YAML-LOAD",
      "LANG-JVM-OBJECT-DESERIALIZATION",
      "LANG-JVM-REFLECTION-ACCESS",
      "LANG-JVM-SQL-CONCAT",
      "LANG-PHP-DYNAMIC-INCLUDE",
      "LANG-PHP-COMMAND-EXECUTION",
      "LANG-C-DANGEROUS-STRING",
      "LANG-C-UNBOUNDED-INPUT",
      "LANG-C-MEMORY-SIZE-OVERFLOW",
      "LANG-CSHARP-INSECURE-DESERIALIZATION",
      "LANG-CSHARP-REFLECTION-LOAD",
      "LANG-CSHARP-UNSAFE-CODE",
      "LANG-SWIFT-SENSITIVE-USERDEFAULTS",
      "LANG-SWIFT-FORCE-UNWRAP",
      "LANG-SWIFT-WEAK-TLS",
    ]) {
      assert.equal(rules.has(expectedRule), true, expectedRule);
    }

    assert.equal(response.traceability.complete, true);
    assert.equal(response.findings.length, response.traceability.findings.length);
    assert.equal(response.findings.length, response.traceability.evidence.length);
    assert.equal(
      response.recommendations.every(
        (recommendation) =>
          recommendation.relatedFindingIds.length > 0 &&
          recommendation.evidenceIds.length > 0,
      ),
      true,
    );
  });
});

function scanFixture() {
  return new RepositoryScanner({
    maxFiles: 500,
    maxDepth: 10,
    maxFileBytes: 100_000,
    maxTotalSourceBytes: 2_000_000,
  }).scan(fixtureDirectory, {
    name: "multi-language-fixture",
    owner: "adam",
    url: "https://github.com/adam/multi-language-fixture",
    defaultBranch: "main",
    commitSha: "fixture-sha",
  });
}
