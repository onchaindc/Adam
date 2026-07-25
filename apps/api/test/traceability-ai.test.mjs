import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AiIntelligenceEngine } from "../dist/intelligence/ai/ai-intelligence-engine.js";
import { AiResultCache } from "../dist/intelligence/ai/ai-result-cache.js";
import { PromptBuilder } from "../dist/intelligence/ai/prompt-builder.js";
import { ReasoningFormatter } from "../dist/intelligence/ai/reasoning-formatter.js";
import { AI_SECTION_KEYS } from "../dist/intelligence/ai/types.js";
import { EvidenceLinkResolver } from "../dist/traceability/evidence-link-resolver.js";
import { EvidenceTraceabilityEngine } from "../dist/traceability/evidence-traceability-engine.js";

describe("Sprint 6.5 evidence and AI boundaries", () => {
  it("links every security recommendation to finding and evidence records", async () => {
    const response = new EvidenceTraceabilityEngine(
      new EvidenceLinkResolver(),
    ).enrichSecurity(
      {
        service: "security-audit",
        status: "completed",
        requestId: "trace-request",
        repository: repository(),
        modulesExecuted: ["secrets"],
        filesAnalyzed: 1,
        findings: [
          {
            id: "ADAM-SEC-0001",
            ruleId: "SEC-TEST",
            category: "secrets",
            title: "Fixture secret",
            severity: "high",
            file: "src/index.ts",
            line: 7,
            description: "Secret detected.",
            evidence: "const token = '[REDACTED]';",
            confidence: "high",
            intelligence: {
              explanation: "A credential is embedded in source.",
              whyItMatters: "The credential may be reused.",
              potentialImpact: "Unauthorized access is possible.",
              likelihood: "medium",
              suggestedRemediation: "Remove the credential.",
              confidence: "high",
              evidenceReferences: ["ADAM-SEC-0001"],
            },
          },
        ],
        securityScore: {
          value: 80,
          maximum: 100,
          scoringVersion: "1.0",
          riskRating: "high",
          categoryScores: [],
        },
        overallRiskRating: "high",
        recommendedFixOrder: [
          {
            priority: 1,
            findingId: "ADAM-SEC-0001",
            title: "Fixture secret",
            severity: "high",
            rationale: "Address exposed credentials first.",
            suggestedRemediation: "Remove the credential.",
          },
        ],
        report: {
          schemaVersion: "1.0",
          repositoryOverview: {
            repository: repository(),
            filesAnalyzed: 1,
            dockerDetected: false,
            ciCdDetected: false,
            smartContractsDetected: false,
          },
          technologyStack: {
            languages: [],
            frameworks: [],
            packageManager: null,
          },
          securityScore: {
            value: 80,
            maximum: 100,
            scoringVersion: "1.0",
            riskRating: "high",
            categoryScores: [],
          },
          overallRiskRating: "high",
          criticalFindings: [],
          highFindings: [],
          mediumFindings: [],
          lowFindings: [],
          recommendedFixOrder: [],
          securitySummary: {
            overview: "Fixture.",
            findingCounts: { critical: 0, high: 1, medium: 0, low: 0 },
            highestPriorityFindingIds: ["ADAM-SEC-0001"],
            evidenceBased: true,
          },
          limitations: [],
        },
        limitations: [],
      },
      "deterministic",
    );

    const recommendation = response.recommendations[0];
    assert.ok(recommendation);
    assert.deepEqual(recommendation.relatedFindingIds, ["ADAM-SEC-0001"]);
    assert.deepEqual(recommendation.evidenceIds, ["ADAM-SEC-EVID-0001"]);
    assert.equal(recommendation.repositoryFile, "src/index.ts");
    assert.deepEqual(recommendation.lineNumbers, [7]);
    assert.equal(recommendation.ruleId, "SEC-TEST");
    assert.equal(response.report.recommendedFixOrder[0].evidenceIds[0], "ADAM-SEC-EVID-0001");
  });

  it("uses the provider once and serves the second identical request from cache", async () => {
    let calls = 0;
    const provider = {
      async generate(prompt) {
        calls += 1;
        const input = JSON.parse(prompt.input);
        const findingId = input.findings[0].findingId;
        const section = (name) => ({
          content: `${name} references ${findingId}.`,
          findingIds: [findingId],
        });
        return {
          provider: "openai",
          model: "test-model",
          outputText: JSON.stringify({
            executiveSummary: section("executiveSummary"),
            developerSummary: section("developerSummary"),
            businessImpact: section("businessImpact"),
            attackNarrative: section("attackNarrative"),
            remediationStrategy: section("remediationStrategy"),
            priorityRoadmap: section("priorityRoadmap"),
            architectureObservations: section("architectureObservations"),
            confidenceSummary: section("confidenceSummary"),
          }),
        };
      },
    };
    const engine = new AiIntelligenceEngine(
      provider,
      new PromptBuilder(),
      new ReasoningFormatter(),
      new AiResultCache(60_000, 10),
    );
    const response = createRootResponse();
    const first = await engine.enhanceRootCause(response);
    const second = await engine.enhanceRootCause(response);

    assert.equal(calls, 1);
    assert.equal(first.aiIntelligence.status, "completed");
    assert.equal(first.aiIntelligence.cacheHit, false);
    assert.equal(second.aiIntelligence.cacheHit, true);
    assert.match(second.aiIntelligence.executiveSummary.content, /ADAM-RCI-FIND-0001/);
  });

  it("replaces fabricated finding references with deterministic evidence", async () => {
    const provider = {
      async generate() {
        const section = {
          content: "Unknown finding ADAM-FAKE-0001.",
          findingIds: ["ADAM-FAKE-0001"],
        };
        return {
          provider: "openai",
          model: "test-model",
          outputText: JSON.stringify({
            executiveSummary: section,
            developerSummary: section,
            businessImpact: section,
            attackNarrative: section,
            remediationStrategy: section,
            priorityRoadmap: section,
            architectureObservations: section,
            confidenceSummary: section,
          }),
        };
      },
    };
    const engine = new AiIntelligenceEngine(
      provider,
      new PromptBuilder(),
      new ReasoningFormatter(),
      new AiResultCache(60_000, 10),
    );

    const enhanced = await engine.enhanceRootCause(createRootResponse());

    for (const key of AI_SECTION_KEYS) {
      const section = enhanced.aiIntelligence[key];
      assert.deepEqual(section.findingIds, ["ADAM-RCI-FIND-0001"]);
      assert.match(section.content, /ADAM-RCI-FIND-0001/);
      assert.doesNotMatch(section.content, /ADAM-FAKE-0001/);
    }
  });

  it("repairs incomplete sections from deterministic evidence", async () => {
    const provider = {
      async generate() {
        const section = {
          content: "The deterministic failure prevents application startup.",
          findingIds: ["ADAM-RCI-FIND-0001"],
        };
        return {
          provider: "gemini",
          model: "test-model",
          outputText: JSON.stringify({
            executiveSummary: section,
            developerSummary: section,
            businessImpact: section,
            attackNarrative: section,
            remediationStrategy: section,
            priorityRoadmap: section,
            confidenceSummary: {
              content: "",
              findingIds: [],
            },
          }),
        };
      },
    };
    const engine = new AiIntelligenceEngine(
      provider,
      new PromptBuilder(),
      new ReasoningFormatter(),
      new AiResultCache(60_000, 10),
    );

    const enhanced = await engine.enhanceRootCause(createRootResponse());

    for (const key of AI_SECTION_KEYS) {
      const section = enhanced.aiIntelligence[key];
      assert.deepEqual(section.findingIds, ["ADAM-RCI-FIND-0001"]);
      assert.match(section.content, /ADAM-RCI-FIND-0001/);
    }
  });

  it("normalizes twenty incomplete response variants without schema failures", () => {
    const formatter = new ReasoningFormatter();
    const finding = {
      findingId: "ADAM-SEC-0001",
      title: "Fixture finding",
      category: "configuration",
      severity: "high",
      confidence: "high",
      repositoryFile: "src/config.ts",
      lineNumbers: [12],
      ruleId: "CONFIG-TEST",
      description: "A deterministic configuration issue was detected.",
      impact: "The application may start with an unsafe setting.",
      evidenceIds: ["ADAM-SEC-EVID-0001"],
      evidence: ["unsafe: true"],
      recommendations: ["Disable the unsafe setting."],
    };

    for (let index = 0; index < 20; index += 1) {
      const section = {
        content:
          index % 2 === 0
            ? "Evidence-backed analysis without an inline identifier."
            : "",
        findingIds: index % 3 === 0 ? [] : [finding.findingId],
      };
      const output = Object.fromEntries(
        AI_SECTION_KEYS.filter(
          (_key, sectionIndex) => sectionIndex !== index % AI_SECTION_KEYS.length,
        ).map((key) => [key, section]),
      );
      const formatted = formatter.format(
        JSON.stringify(output),
        [finding],
      );

      for (const key of AI_SECTION_KEYS) {
        assert.deepEqual(formatted[key].findingIds, [finding.findingId]);
        assert.match(formatted[key].content, /ADAM-SEC-0001/);
      }
    }
  });

  it("rebuilds malformed provider JSON from deterministic evidence", () => {
    const formatter = new ReasoningFormatter();
    const finding = {
      findingId: "ADAM-SEC-0001",
      title: "Fixture finding",
      category: "configuration",
      severity: "high",
      confidence: "high",
      repositoryFile: "src/config.ts",
      lineNumbers: [12],
      ruleId: "CONFIG-TEST",
      description: "A deterministic configuration issue was detected.",
      impact: "The application may start with an unsafe setting.",
      evidenceIds: ["ADAM-SEC-EVID-0001"],
      evidence: ["unsafe: true"],
      recommendations: ["Disable the unsafe setting."],
    };

    const formatted = formatter.format("not-json", [finding]);

    for (const key of AI_SECTION_KEYS) {
      assert.deepEqual(formatted[key].findingIds, [finding.findingId]);
      assert.match(formatted[key].content, /ADAM-SEC-0001/);
    }
  });
});

function createRootResponse() {
  return new EvidenceTraceabilityEngine(
    new EvidenceLinkResolver(),
  ).enrichRootCause(
    {
      service: "root-cause-investigation",
      status: "completed",
      requestId: "root-request",
      investigationId: "ADAM-RCI-root-request",
      repository: repository(),
      rootCause: {
        category: "module-resolution",
        title: "Module resolution failed",
        summary: "The application could not resolve a declared dependency.",
      },
      confidence: { score: 90, level: "high" },
      evidence: [
        {
          id: "ADAM-RCI-EVID-0001",
          type: "log-entry",
          source: "build",
          reference: "build:line-1",
          excerpt: "Cannot find module 'express'",
        },
      ],
      impact: "The application cannot start.",
      recommendedFixes: ["Install the missing dependency."],
      prevention: ["Run clean builds in CI."],
      relatedFiles: ["src/index.ts"],
      relatedDependencies: ["express"],
      supportingLogEntries: [
        {
          id: "LOG-00001",
          source: "build",
          label: "build",
          line: 1,
          timestamp: null,
          text: "Cannot find module 'express'",
        },
      ],
      pipeline: [
        "receive-inputs",
        "normalize-logs",
        "identify-error-signals",
        "correlate-repository-context",
        "generate-candidate-causes",
        "rank-causes",
        "select-most-probable-cause",
        "produce-investigation-result",
      ],
      limitations: [],
    },
    "deterministic",
  );
}

function repository() {
  return {
    name: "fixture",
    owner: "adam",
    url: "https://github.com/adam/fixture",
    defaultBranch: "main",
    commitSha: "abc123",
  };
}
