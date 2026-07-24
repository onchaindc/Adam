import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { SecurityIntelligenceEngine } from "../dist/intelligence/security/security-intelligence-engine.js";
import { ExecutionPlanner } from "../dist/planner/execution-planner.js";
import { DeterministicIntentClassifier } from "../dist/planner/intent-classifier.js";
import { PlannerEngine } from "../dist/planner/planner-engine.js";
import { ResponseAggregator } from "../dist/planner/response-aggregator.js";
import { ServiceOrchestrator } from "../dist/planner/service-orchestrator.js";
import { PlannerService } from "../dist/services/planner-service.js";
import { RepositoryIntelligenceService } from "../dist/services/repository-intelligence-service.js";
import { RootCauseInvestigationService } from "../dist/services/root-cause-investigation-service.js";
import { SecurityAuditService } from "../dist/services/security-audit-service.js";

describe("Planner orchestration", () => {
  it("executes all services against one acquired Repository Model", async () => {
    const model = createModel();
    let acquisitions = 0;
    let scans = 0;
    let cleanups = 0;
    let duplicateAcquisitions = 0;
    const primaryAcquirer = {
      async acquire() {
        acquisitions += 1;
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
            cleanups += 1;
          },
        };
      },
    };
    const scanner = {
      async scan() {
        scans += 1;
        return model;
      },
    };
    const forbiddenAcquirer = {
      async acquire() {
        duplicateAcquisitions += 1;
        throw new Error("context service attempted a duplicate acquisition");
      },
    };
    const forbiddenScanner = {
      async scan() {
        throw new Error("context service attempted a duplicate scan");
      },
    };
    const repositoryService = new RepositoryIntelligenceService(
      forbiddenAcquirer,
      forbiddenScanner,
    );
    const securityService = new SecurityAuditService(
      forbiddenAcquirer,
      forbiddenScanner,
      {
        analyze(inputModel) {
          assert.equal(inputModel, model);
          return {
            modulesExecuted: ["secrets"],
            filesAnalyzed: 1,
            findings: [],
            limitations: [],
          };
        },
      },
      new SecurityIntelligenceEngine(),
    );
    const investigationService = new RootCauseInvestigationService(
      forbiddenAcquirer,
      forbiddenScanner,
      {
        investigate(inputModel, logs) {
          assert.equal(inputModel, model);
          assert.equal(logs.length, 1);
          return {
            candidate: {
              detectorId: "dependency-causes",
              category: "module-resolution",
              title: "Module resolution failed",
              summary: "A required module could not be resolved.",
              score: 90,
              impact: "The build cannot complete.",
              recommendedFixes: ["Install the missing dependency."],
              prevention: ["Run clean builds in CI."],
              supportingEntryIds: ["LOG-00001"],
              relatedFiles: ["src/index.ts"],
              relatedDependencies: ["express"],
            },
            entries: [
              {
                id: "LOG-00001",
                source: "build",
                label: null,
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
    const plannerService = new PlannerService(
      primaryAcquirer,
      scanner,
      new PlannerEngine(
        new DeterministicIntentClassifier(),
        new ExecutionPlanner(),
        new ServiceOrchestrator([
          repositoryService,
          securityService,
          investigationService,
        ]),
        new ResponseAggregator(),
      ),
    );

    const response = await plannerService.execute({
      requestId: "planner-request",
      input: {
        request:
          "Audit this repository and explain why the deployment failed",
        repositoryUrl: "https://github.com/adam/fixture",
        logs: [
          {
            source: "build",
            content: "Cannot find module 'express'",
          },
        ],
      },
    });

    assert.equal(acquisitions, 1);
    assert.equal(scans, 1);
    assert.equal(cleanups, 1);
    assert.equal(duplicateAcquisitions, 0);
    assert.equal(response.requestSummary.intent, "combined-analysis");
    assert.deepEqual(response.servicesExecuted, [
      "repository-intelligence",
      "security-audit",
      "root-cause-investigation",
    ]);
    assert.equal(response.repositoryOverview.repository.commitSha, "abc123");
    assert.equal(response.securityAssessment.overallRiskRating, "low");
    assert.equal(
      response.rootCauseInvestigation.rootCause.category,
      "module-resolution",
    );
    assert.equal(response.overallRisk.rating, "low");
    assert.deepEqual(response.overallRecommendations, [
      "Install the missing dependency.",
    ]);
    assert.equal(response.executionMetadata.sharedRepositoryModel, true);
    assert.equal(response.executionMetadata.repositoryAcquisitions, 1);
    assert.equal(response.executionMetadata.timeline.length, 3);
  });

  it("cleans the repository when orchestration fails", async () => {
    let cleaned = false;
    const plannerService = new PlannerService(
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
      { async scan() { return createModel(); } },
      {
        prepare() {
          return {
            classification: {
              intent: "security-audit",
              confidence: "medium",
              matchedSignals: ["audit"],
              rationale: "Security request.",
            },
            plan: {
              intent: "security-audit",
              steps: [],
              omittedServices: [],
            },
          };
        },
        async execute() {
          throw new Error("orchestration failed");
        },
      },
    );

    await assert.rejects(
      plannerService.execute({
        requestId: "planner-failure",
        input: {
          request: "Audit this repository",
          repositoryUrl: "https://github.com/adam/fixture",
          logs: [],
        },
      }),
      /orchestration failed/,
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
    manifestContents: {
      "package.json": JSON.stringify({
        dependencies: { express: "5.2.1" },
      }),
    },
    analysisLimitations: [],
    summary: {
      repository: identity,
      languages: [{ name: "TypeScript", fileCount: 1, percentage: 100 }],
      frameworks: [],
      packageManager: { name: "npm", confidence: "high", evidence: [] },
      structure: {
        topLevelEntries: ["src"],
        directories: ["src"],
        fileTree: ["src/index.ts"],
      },
      docker: { detected: false, files: [] },
      ciCd: { detected: false, files: [] },
      smartContracts: { detected: false, solidityFiles: [] },
      environmentFiles: [],
      configurationFiles: ["package.json"],
      totalFilesScanned: 1,
      ignoredDirectories: [],
      limitations: [],
    },
  };
}
