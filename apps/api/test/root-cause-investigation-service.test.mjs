import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RootCauseInvestigationService } from "../dist/services/root-cause-investigation-service.js";

describe("RootCauseInvestigationService", () => {
  it("returns a structured investigation and cleans the repository", async () => {
    let cleaned = false;
    const service = new RootCauseInvestigationService(
      acquirer(() => {
        cleaned = true;
      }),
      { async scan() { return createModel(); } },
      {
        investigate() {
          return {
            candidate: candidate(),
            entries: [
              {
                id: "LOG-00001",
                source: "build",
                label: "CI build",
                line: 1,
                timestamp: null,
                text: "Cannot find module 'express'",
              },
            ],
            candidateCount: 1,
            limitations: [],
          };
        },
      },
    );

    const response = await service.execute({
      requestId: "request-1",
      input: {
        repositoryUrl: "https://github.com/adam/fixture",
        logs: [{ source: "build", content: "Cannot find module 'express'" }],
      },
    });

    assert.equal(response.status, "completed");
    assert.equal(response.investigationId, "ADAM-RCI-request-1");
    assert.equal(response.rootCause.category, "module-resolution");
    assert.equal(response.evidence.length, 3);
    assert.equal(response.pipeline.length, 8);
    assert.equal(cleaned, true);
  });

  it("cleans the repository when investigation fails", async () => {
    let cleaned = false;
    const service = new RootCauseInvestigationService(
      acquirer(() => {
        cleaned = true;
      }),
      { async scan() { return createModel(); } },
      { investigate() { throw new Error("investigation failed"); } },
    );

    await assert.rejects(
      service.execute({
        requestId: "request-2",
        input: {
          repositoryUrl: "https://github.com/adam/fixture",
          logs: [{ source: "runtime", content: "failure" }],
        },
      }),
      /investigation failed/,
    );
    assert.equal(cleaned, true);
  });
});

function acquirer(onCleanup) {
  return {
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
          onCleanup();
        },
      };
    },
  };
}

function candidate() {
  return {
    detectorId: "dependency-causes",
    category: "module-resolution",
    title: "Module resolution failed",
    summary: "A module could not be resolved.",
    score: 88,
    impact: "The application cannot start.",
    recommendedFixes: ["Declare and install the dependency."],
    prevention: ["Run clean builds in CI."],
    supportingEntryIds: ["LOG-00001"],
    relatedFiles: ["apps/api/src/server.ts"],
    relatedDependencies: ["express"],
  };
}

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
    files: [],
    directories: [],
    topLevelEntries: [],
    manifestContents: {},
    analysisLimitations: [],
    summary: {
      repository: identity,
      languages: [],
      frameworks: [],
      packageManager: null,
      structure: { topLevelEntries: [], directories: [], fileTree: [] },
      docker: { detected: false, files: [] },
      ciCd: { detected: false, files: [] },
      smartContracts: { detected: false, solidityFiles: [] },
      environmentFiles: [],
      configurationFiles: [],
      totalFilesScanned: 0,
      ignoredDirectories: [],
      limitations: [],
    },
  };
}
