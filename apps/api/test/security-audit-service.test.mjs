import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SecurityIntelligenceEngine } from "../dist/intelligence/security/security-intelligence-engine.js";
import { SecurityAuditService } from "../dist/services/security-audit-service.js";

describe("SecurityAuditService", () => {
  it("returns engine findings and cleans the acquired repository", async () => {
    let cleaned = false;
    const model = createModel();
    const service = new SecurityAuditService(
      {
        async acquire() {
          return {
            reference: {
              owner: "adam",
              name: "fixture",
              canonicalUrl: "https://github.com/adam/fixture.git",
            },
            directory: "temporary-repository",
            defaultBranch: "main",
            commitSha: "abc123",
            async cleanup() {
              cleaned = true;
            },
          };
        },
      },
      {
        async scan() {
          return model;
        },
      },
      {
        analyze() {
          return {
            modulesExecuted: ["secrets"],
            filesAnalyzed: 1,
            findings: [
              {
                id: "ADAM-SEC-0001",
                ruleId: "SEC-TEST",
                category: "secrets",
                title: "Fixture",
                severity: "high",
                file: "src/index.ts",
                line: 1,
                description: "Fixture description.",
                evidence: "[REDACTED]",
                confidence: "high",
              },
            ],
            limitations: [],
          };
        },
      },
      new SecurityIntelligenceEngine(),
    );

    const response = await service.execute({
      requestId: "request-1",
      input: { repositoryUrl: "https://github.com/adam/fixture" },
    });

    assert.equal(response.status, "completed");
    assert.equal(response.findings.length, 1);
    assert.equal(response.findings[0].intelligence.evidenceReferences[0], "ADAM-SEC-0001");
    assert.equal(response.securityScore.value < 100, true);
    assert.equal(response.report.highFindings.length, 1);
    assert.equal(cleaned, true);
  });

  it("cleans the acquired repository when analysis fails", async () => {
    let cleaned = false;
    const service = new SecurityAuditService(
      {
        async acquire() {
          return {
            reference: {
              owner: "adam",
              name: "fixture",
              canonicalUrl: "https://github.com/adam/fixture.git",
            },
            directory: "temporary-repository",
            defaultBranch: "main",
            commitSha: "abc123",
            async cleanup() {
              cleaned = true;
            },
          };
        },
      },
      {
        async scan() {
          return createModel();
        },
      },
      {
        analyze() {
          throw new Error("analysis failed");
        },
      },
      new SecurityIntelligenceEngine(),
    );

    await assert.rejects(
      service.execute({
        requestId: "request-2",
        input: { repositoryUrl: "https://github.com/adam/fixture" },
      }),
      /analysis failed/,
    );
    assert.equal(cleaned, true);
  });
});

function createModel() {
  const identity = {
    name: "fixture",
    owner: "adam",
    url: "https://github.com/adam/fixture",
    defaultBranch: "main",
    commitSha: "abc123",
  };

  return {
    identity,
    rootDirectory: "temporary-repository",
    files: [
      {
        path: "src/index.ts",
        extension: ".ts",
        sizeBytes: 20,
        content: "export const ok = true;",
      },
    ],
    directories: ["src"],
    topLevelEntries: ["src"],
    manifestContents: {},
    analysisLimitations: [],
    summary: {
      repository: identity,
      languages: [],
      frameworks: [],
      packageManager: null,
      structure: {
        topLevelEntries: ["src"],
        directories: ["src"],
        fileTree: ["src/index.ts"],
      },
      docker: { detected: false, files: [] },
      ciCd: { detected: false, files: [] },
      smartContracts: { detected: false, solidityFiles: [] },
      environmentFiles: [],
      configurationFiles: [],
      totalFilesScanned: 1,
      ignoredDirectories: [],
      limitations: [],
    },
  };
}
