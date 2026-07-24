import assert from "node:assert/strict";
import { describe, it } from "node:test";

import pino from "pino";

import { createApp } from "../dist/app.js";
import { loadEnvironment } from "../dist/config/environment.js";
import { PlannerInputError } from "../dist/planner/errors.js";

describe("HTTP routes", () => {
  it("serves health and implemented service responses", async () => {
    const dispatcher = {
      async dispatch(service, request) {
        if (service === "security-audit") {
          return {
            service,
            status: "completed",
            requestId: request.requestId,
            repository: {
              name: "Adam",
              owner: "onchaindc",
              url: "https://github.com/onchaindc/Adam",
              defaultBranch: "main",
              commitSha: "abc123",
            },
            modulesExecuted: ["secrets"],
            filesAnalyzed: 1,
            findings: [],
            securityScore: {
              value: 100,
              maximum: 100,
              scoringVersion: "1.0",
              riskRating: "low",
              categoryScores: [],
            },
            overallRiskRating: "low",
            recommendedFixOrder: [],
            report: {
              schemaVersion: "1.0",
              repositoryOverview: {
                repository: {
                  name: "Adam",
                  owner: "onchaindc",
                  url: "https://github.com/onchaindc/Adam",
                  defaultBranch: "main",
                  commitSha: "abc123",
                },
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
                value: 100,
                maximum: 100,
                scoringVersion: "1.0",
                riskRating: "low",
                categoryScores: [],
              },
              overallRiskRating: "low",
              criticalFindings: [],
              highFindings: [],
              mediumFindings: [],
              lowFindings: [],
              recommendedFixOrder: [],
              securitySummary: {
                overview: "No findings.",
                findingCounts: {
                  critical: 0,
                  high: 0,
                  medium: 0,
                  low: 0,
                },
                highestPriorityFindingIds: [],
                evidenceBased: true,
              },
              limitations: [],
            },
            limitations: [],
          };
        }

        if (service === "repository-intelligence") {
          return {
            service,
            status: "completed",
            requestId: request.requestId,
            summary: {
              repository: {
                name: "Adam",
                owner: "onchaindc",
                url: "https://github.com/onchaindc/Adam",
                defaultBranch: "main",
                commitSha: "abc123",
              },
              languages: [],
              frameworks: [],
              packageManager: null,
              structure: {
                topLevelEntries: [],
                directories: [],
                fileTree: [],
              },
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

        return {
          service: "root-cause-investigation",
          status: "completed",
          requestId: request.requestId,
          investigationId: `ADAM-RCI-${request.requestId}`,
          repository: {
            name: "Adam",
            owner: "onchaindc",
            url: "https://github.com/onchaindc/Adam",
            defaultBranch: "main",
            commitSha: "abc123",
          },
          rootCause: {
            category: "module-resolution",
            title: "Module resolution failed",
            summary: "A required module could not be resolved.",
          },
          confidence: { score: 90, level: "high" },
          evidence: [],
          impact: "The application cannot start.",
          recommendedFixes: ["Install the declared dependency."],
          prevention: ["Run clean builds in CI."],
          relatedFiles: ["apps/api/src/server.ts"],
          relatedDependencies: ["express"],
          supportingLogEntries: [],
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
        };
      },
    };
    const app = createApp({
      dispatcher,
      environment: loadEnvironment({ NODE_ENV: "test" }),
      logger: pino({ enabled: false }),
      plannerService: {
        async execute(request) {
          if (request.input.request === "Why is my build failing?") {
            throw new PlannerInputError(
              "Root Cause Investigation requests require logs.",
            );
          }
          return {
            service: "planner",
            status: "completed",
            requestId: request.requestId,
            requestSummary: {
              request: request.input.request,
              intent: "security-audit",
              confidence: "medium",
            },
            plannerDecision: {
              classification: {
                intent: "security-audit",
                confidence: "medium",
                matchedSignals: ["audit"],
                rationale: "Security request.",
              },
              executionPlan: {
                intent: "security-audit",
                steps: [
                  {
                    order: 1,
                    service: "repository-intelligence",
                    prerequisites: [],
                    reason: "Repository context.",
                  },
                  {
                    order: 2,
                    service: "security-audit",
                    prerequisites: ["repository-intelligence"],
                    reason: "Security audit.",
                  },
                ],
                omittedServices: [],
              },
              decisions: [],
            },
            servicesExecuted: [
              "repository-intelligence",
              "security-audit",
            ],
            repositoryOverview: {
              repository: {
                name: "Adam",
                owner: "onchaindc",
                url: "https://github.com/onchaindc/Adam",
                defaultBranch: "main",
                commitSha: "abc123",
              },
              languages: [],
              frameworks: [],
              packageManager: null,
              structure: {
                topLevelEntries: [],
                directories: [],
                fileTree: [],
              },
              docker: { detected: false, files: [] },
              ciCd: { detected: false, files: [] },
              smartContracts: { detected: false, solidityFiles: [] },
              environmentFiles: [],
              configurationFiles: [],
              totalFilesScanned: 0,
              ignoredDirectories: [],
              limitations: [],
            },
            securityAssessment: null,
            rootCauseInvestigation: null,
            overallRisk: {
              rating: "not-assessed",
              basis: "Fixture.",
            },
            overallRecommendations: [],
            executionMetadata: {
              startedAt: "2026-07-24T00:00:00.000Z",
              completedAt: "2026-07-24T00:00:00.001Z",
              durationMs: 1,
              timeline: [],
              sharedRepositoryModel: true,
              repositoryAcquisitions: 1,
            },
          };
        },
      },
      runtimeState: {
        instanceId: "test-instance",
        bootCount: 1,
        firstStartedAt: "2026-07-22T00:00:00.000Z",
        lastStartedAt: "2026-07-22T00:00:00.000Z",
      },
    });
    const server = app.listen(0);

    try {
      await new Promise((resolve) => server.once("listening", resolve));
      const address = server.address();
      assert(address && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const health = await fetch(`${baseUrl}/health`);
      const audit = await fetch(`${baseUrl}/audit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repositoryUrl: "placeholder" }),
      });
      const repositorySummary = await fetch(
        `${baseUrl}/repository/summary`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            repositoryUrl: "https://github.com/onchaindc/Adam",
          }),
        },
      );
      const invalidRepositorySummary = await fetch(
        `${baseUrl}/repository/summary`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const investigation = await fetch(`${baseUrl}/investigate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repositoryUrl: "https://github.com/onchaindc/Adam",
          logs: [
            {
              source: "build",
              label: "CI build",
              content: "Cannot find module 'express'",
            },
          ],
        }),
      });
      const invalidInvestigation = await fetch(`${baseUrl}/investigate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repositoryUrl: "https://github.com/onchaindc/Adam",
          logs: [],
        }),
      });
      const planned = await fetch(`${baseUrl}/plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request: "Audit this repository",
          repositoryUrl: "https://github.com/onchaindc/Adam",
        }),
      });
      const invalidPlan = await fetch(`${baseUrl}/plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          repositoryUrl: "https://github.com/onchaindc/Adam",
        }),
      });
      const rootCausePlanWithoutLogs = await fetch(`${baseUrl}/plan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request: "Why is my build failing?",
          repositoryUrl: "https://github.com/onchaindc/Adam",
        }),
      });

      assert.equal(health.status, 200);
      assert.deepEqual(
        {
          ...(await health.json()),
          requestId: "ignored",
        },
        {
          status: "ok",
          requestId: "ignored",
          runtime: { instanceId: "test-instance", bootCount: 1 },
        },
      );
      assert.equal(audit.status, 200);
      assert.deepEqual(
        {
          ...(await audit.json()),
          requestId: "ignored",
        },
        {
          service: "security-audit",
          status: "completed",
          requestId: "ignored",
          repository: {
            name: "Adam",
            owner: "onchaindc",
            url: "https://github.com/onchaindc/Adam",
            defaultBranch: "main",
            commitSha: "abc123",
          },
          modulesExecuted: ["secrets"],
          filesAnalyzed: 1,
          findings: [],
          securityScore: {
            value: 100,
            maximum: 100,
            scoringVersion: "1.0",
            riskRating: "low",
            categoryScores: [],
          },
          overallRiskRating: "low",
          recommendedFixOrder: [],
          report: {
            schemaVersion: "1.0",
            repositoryOverview: {
              repository: {
                name: "Adam",
                owner: "onchaindc",
                url: "https://github.com/onchaindc/Adam",
                defaultBranch: "main",
                commitSha: "abc123",
              },
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
              value: 100,
              maximum: 100,
              scoringVersion: "1.0",
              riskRating: "low",
              categoryScores: [],
            },
            overallRiskRating: "low",
            criticalFindings: [],
            highFindings: [],
            mediumFindings: [],
            lowFindings: [],
            recommendedFixOrder: [],
            securitySummary: {
              overview: "No findings.",
              findingCounts: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
              },
              highestPriorityFindingIds: [],
              evidenceBased: true,
            },
            limitations: [],
          },
          limitations: [],
        },
      );
      assert.equal(repositorySummary.status, 200);
      assert.equal((await repositorySummary.json()).status, "completed");
      assert.equal(invalidRepositorySummary.status, 400);
      assert.equal(investigation.status, 200);
      assert.equal(
        (await investigation.json()).rootCause.category,
        "module-resolution",
      );
      assert.equal(invalidInvestigation.status, 400);
      assert.equal(planned.status, 200);
      assert.deepEqual((await planned.json()).servicesExecuted, [
        "repository-intelligence",
        "security-audit",
      ]);
      assert.equal(invalidPlan.status, 400);
      assert.equal(rootCausePlanWithoutLogs.status, 400);
      assert.equal(
        (await rootCausePlanWithoutLogs.json()).error,
        "invalid-plan-input",
      );
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
