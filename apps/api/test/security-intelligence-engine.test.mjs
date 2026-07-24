import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SecurityIntelligenceEngine } from "../dist/intelligence/security/security-intelligence-engine.js";

describe("SecurityIntelligenceEngine", () => {
  it("builds evidence-bound intelligence, scoring, and fix ordering", () => {
    const engine = new SecurityIntelligenceEngine();
    const input = {
      repositorySummary: createSummary(),
      modulesExecuted: [
        "secrets",
        "dependencies",
        "authentication-authorization",
        "configuration",
        "static-pattern",
      ],
      filesAnalyzed: 12,
      findings: [
        finding({
          id: "ADAM-SEC-0001",
          ruleId: "SEC-PRIVATE-KEY",
          category: "secrets",
          title: "Private key material",
          severity: "critical",
          file: "src/key.ts",
          line: 4,
          evidence: "const key = [REDACTED];",
          confidence: "high",
        }),
        finding({
          id: "ADAM-SEC-0002",
          ruleId: "AUTH-CLIENT-CONTROLLED-ROLE",
          category: "authentication-authorization",
          title: "Authorization role sourced from request input",
          severity: "high",
          file: "src/auth.ts",
          line: 18,
          evidence: "role = req.body.role",
          confidence: "high",
        }),
        finding({
          id: "ADAM-SEC-0003",
          ruleId: "DEP-KNOWN-VULNERABLE-RANGE-LODASH",
          category: "dependencies",
          title: "Dependency range may include known vulnerable versions",
          severity: "high",
          file: "package.json",
          line: 12,
          evidence: '"lodash": "4.17.20"',
          confidence: "medium",
        }),
      ],
      limitations: ["Static analysis only."],
    };

    const first = engine.analyze(input);
    const second = engine.analyze(input);

    assert.deepEqual(first, second);
    assert.equal(first.overallRiskRating, "critical");
    assert.equal(first.securityScore.scoringVersion, "1.0");
    assert.equal(first.securityScore.value < 100, true);
    assert.equal(first.report.criticalFindings.length, 1);
    assert.equal(first.report.highFindings.length, 2);
    assert.equal(first.report.mediumFindings.length, 0);
    assert.equal(first.recommendedFixOrder[0].findingId, "ADAM-SEC-0001");
    assert.equal(first.report.repositoryOverview.filesAnalyzed, 12);
    assert.equal(first.report.technologyStack.frameworks[0].name, "Express");
    assert.equal(first.report.securitySummary.evidenceBased, true);
    assert.match(
      first.report.securitySummary.overview,
      /ADAM-SEC-0001/,
    );

    for (const enriched of first.findings) {
      assert.deepEqual(enriched.intelligence.evidenceReferences, [
        enriched.id,
      ]);
      assert.match(enriched.intelligence.explanation, new RegExp(enriched.id));
      assert.match(
        enriched.intelligence.explanation,
        new RegExp(enriched.file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
      assert.equal(
        enriched.intelligence.confidenceLevel,
        enriched.confidence,
      );
    }

    const authorizationScore = first.securityScore.categoryScores.find(
      (category) => category.category === "authorization",
    );
    assert.equal(authorizationScore?.findingCount, 1);
  });

  it("returns a cautious clean report when analyzers produce no findings", () => {
    const result = new SecurityIntelligenceEngine().analyze({
      repositorySummary: createSummary(),
      modulesExecuted: [
        "secrets",
        "dependencies",
        "authentication-authorization",
        "configuration",
        "static-pattern",
      ],
      filesAnalyzed: 8,
      findings: [],
      limitations: [],
    });

    assert.equal(result.securityScore.value, 100);
    assert.equal(result.overallRiskRating, "low");
    assert.deepEqual(result.recommendedFixOrder, []);
    assert.deepEqual(result.findings, []);
    assert.match(
      result.report.securitySummary.overview,
      /does not prove that the repository is vulnerability-free/,
    );
  });
});

function finding(overrides) {
  return {
    id: "ADAM-SEC-9999",
    ruleId: "TEST-RULE",
    category: "configuration",
    title: "Test finding",
    severity: "medium",
    file: "src/index.ts",
    line: 1,
    description: "The configured analyzer detected a test condition.",
    evidence: "test = true",
    confidence: "medium",
    ...overrides,
  };
}

function createSummary() {
  return {
    repository: {
      name: "fixture",
      owner: "adam",
      url: "https://github.com/adam/fixture",
      defaultBranch: "main",
      commitSha: "abc123",
    },
    languages: [
      { name: "TypeScript", fileCount: 8, percentage: 100 },
    ],
    frameworks: [
      { name: "Express", confidence: "high", evidence: ["package.json"] },
    ],
    packageManager: {
      name: "pnpm",
      confidence: "high",
      evidence: ["pnpm-lock.yaml"],
    },
    structure: {
      topLevelEntries: ["src"],
      directories: ["src"],
      fileTree: ["src/index.ts"],
    },
    docker: { detected: true, files: ["Dockerfile"] },
    ciCd: { detected: true, files: [".github/workflows/ci.yml"] },
    smartContracts: { detected: false, solidityFiles: [] },
    environmentFiles: [],
    configurationFiles: ["package.json"],
    totalFilesScanned: 12,
    ignoredDirectories: [],
    limitations: [],
  };
}
