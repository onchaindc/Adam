import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { describe, it } from "node:test";

import { SecurityAuditEngine } from "../dist/analyzers/security/security-audit-engine.js";
import { StaticSecurityPatternInspector } from "../dist/analyzers/security/static-security-pattern-inspector.js";
import { SecurityIntelligenceEngine } from "../dist/intelligence/security/security-intelligence-engine.js";
import { PullRequestFetcher } from "../dist/investigation/pull-request/pull-request-fetcher.js";
import { parsePullRequestReference } from "../dist/investigation/pull-request/pull-request-reference.js";
import { RepositoryScanner } from "../dist/investigation/repository/repository-scanner.js";
import { ExecutionPlanner } from "../dist/planner/execution-planner.js";
import { DeterministicIntentClassifier } from "../dist/planner/intent-classifier.js";
import { PlannerEngine } from "../dist/planner/planner-engine.js";
import { ResponseAggregator } from "../dist/planner/response-aggregator.js";
import { ServiceOrchestrator } from "../dist/planner/service-orchestrator.js";
import { PlannerService } from "../dist/services/planner-service.js";
import { PullRequestReviewService } from "../dist/services/pull-request-review-service.js";
import { EvidenceLinkResolver } from "../dist/traceability/evidence-link-resolver.js";
import { EvidenceTraceabilityEngine } from "../dist/traceability/evidence-traceability-engine.js";

describe("Pull Request Review", () => {
  it("parses URL and coordinate request forms", () => {
    assert.deepEqual(
      parsePullRequestReference({
        pullRequest: "https://github.com/onchaindc/Adam/pull/3",
      }),
      {
        owner: "onchaindc",
        repository: "Adam",
        pullNumber: 3,
      },
    );
    assert.deepEqual(
      parsePullRequestReference({
        owner: "onchaindc",
        repo: "Adam",
        pullNumber: 3,
      }),
      {
        owner: "onchaindc",
        repository: "Adam",
        pullNumber: 3,
      },
    );
    assert.throws(
      () =>
        parsePullRequestReference({
          pullRequest: "https://example.com/onchaindc/Adam/pull/3",
        }),
      /github\.com/i,
    );
  });

  it("reviews only changed files and falls back when AI is unavailable", async () => {
    const fetcher = createFetcher();
    const acquired = await fetcher.fetch({
      pullRequest: "https://github.com/onchaindc/Adam/pull/3",
    });
    const workspace = acquired.directory;
    assert.equal(acquired.changedFiles.length, 1);
    assert.equal(acquired.changedFiles[0].patch.includes("+eval(input)"), true);
    assert.equal(acquired.changedFiles[0].contentAvailable, true);
    await acquired.cleanup();
    await assert.rejects(access(workspace));

    const service = createService(createFetcher(), null);
    const response = await service.execute({
      requestId: "pr-review",
      input: {
        owner: "onchaindc",
        repo: "Adam",
        pullNumber: 3,
        analysisMode: "intelligent",
      },
    });

    assert.equal(response.status, "completed");
    assert.equal(response.pullRequest.number, 3);
    assert.equal(response.summary.filesChanged, 1);
    assert.equal(response.summary.filesAnalyzed, 1);
    assert.equal(response.changedFiles[0].filename, "src/changed.ts");
    assert.equal(response.findings.some((finding) => finding.ruleId.includes("EVAL")), true);
    assert.equal(response.traceability.complete, true);
    assert.equal(
      response.recommendations.every(
        (recommendation) =>
          recommendation.relatedFindingIds.length > 0 &&
          recommendation.evidenceIds.length > 0,
      ),
      true,
    );
    assert.equal(response.aiReview, null);
    assert.equal(
      response.summary.limitations.some((item) =>
        item.includes("deterministic PR review completed"),
      ),
      true,
    );

    let repositoryAcquisitions = 0;
    const planner = new PlannerService(
      {
        async acquire() {
          repositoryAcquisitions += 1;
          throw new Error("repository acquisition must not run");
        },
      },
      {
        async scan() {
          throw new Error("repository scan must not run");
        },
      },
      new PlannerEngine(
        new DeterministicIntentClassifier(),
        new ExecutionPlanner(),
        new ServiceOrchestrator([]),
        new ResponseAggregator(),
      ),
      new EvidenceTraceabilityEngine(new EvidenceLinkResolver()),
      null,
      {
        async execute() {
          return response;
        },
      },
    );
    const planned = await planner.execute({
      requestId: "planner-pr",
      input: {
        request: "Inspect PR #3",
        owner: "onchaindc",
        repo: "Adam",
        pullNumber: 3,
        logs: [],
        analysisMode: "deterministic",
      },
    });

    assert.equal(repositoryAcquisitions, 0);
    assert.equal(planned.requestSummary.intent, "pull-request-review");
    assert.deepEqual(planned.servicesExecuted, ["pull-request-review"]);
    assert.equal(planned.pullRequestReview.pullRequest.number, 3);
    assert.equal(planned.executionMetadata.repositoryAcquisitions, 0);
  });
});

function createService(fetcher, aiIntelligence) {
  return new PullRequestReviewService(
    fetcher,
    new RepositoryScanner({
      maxFiles: 100,
      maxDepth: 10,
      maxFileBytes: 100_000,
      maxTotalSourceBytes: 1_000_000,
    }),
    new SecurityAuditEngine([new StaticSecurityPatternInspector()]),
    new SecurityIntelligenceEngine(),
    new EvidenceTraceabilityEngine(new EvidenceLinkResolver()),
    aiIntelligence,
  );
}

function createFetcher() {
  return new PullRequestFetcher({
    timeoutMs: 5_000,
    maxFiles: 10,
    maxFileBytes: 100_000,
    maxTotalSourceBytes: 1_000_000,
    maxPatchBytes: 100_000,
    fetchImplementation: async (url) => {
      const value = String(url);
      if (value.endsWith("/pulls/3")) {
        return response(value, {
          number: 3,
          html_url: "https://github.com/onchaindc/Adam/pull/3",
          title: "Review fixture",
          body: "Fixture description",
          state: "open",
          draft: false,
          commits: 1,
          changed_files: 1,
          additions: 1,
          deletions: 0,
          user: { login: "contributor" },
          base: {
            ref: "main",
            sha: "base123",
            repo: {
              name: "Adam",
              html_url: "https://github.com/onchaindc/Adam",
              default_branch: "main",
              private: false,
              owner: { login: "onchaindc" },
            },
          },
          head: { ref: "feature/review", sha: "head123" },
        });
      }
      if (value.includes("/pulls/3/files")) {
        return response(value, [
          {
            filename: "src/changed.ts",
            status: "modified",
            additions: 1,
            deletions: 0,
            changes: 1,
            patch: "@@ -1 +1 @@\n+eval(input)",
            raw_url:
              "https://github.com/onchaindc/Adam/raw/head123/src%2Fchanged.ts",
          },
        ]);
      }
      if (value.startsWith("https://github.com/onchaindc/Adam/raw/")) {
        return response(
          "https://raw.githubusercontent.com/onchaindc/Adam/head123/src/changed.ts",
          "eval(input)\n",
          "text/plain",
        );
      }
      return response(value, { message: "not found" }, "application/json", 404);
    },
  });
}

function response(url, body, contentType = "application/json", status = 200) {
  const value =
    contentType === "application/json" ? JSON.stringify(body) : body;
  const result = new Response(value, {
    status,
    headers: { "content-type": contentType },
  });
  Object.defineProperty(result, "url", { value: url });
  return result;
}
