import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ExecutionPlanner } from "../dist/planner/execution-planner.js";
import { DeterministicIntentClassifier } from "../dist/planner/intent-classifier.js";
import { planRequest } from "../dist/planner/planner.js";

describe("planRequest", () => {
  it("routes security audit requests", () => {
    assert.deepEqual(planRequest({ requestedService: "security-audit" }), {
      service: "security-audit",
      prerequisites: ["repository-intelligence"],
    });
  });

  it("routes root cause investigation requests", () => {
    assert.deepEqual(
      planRequest({ requestedService: "root-cause-investigation" }),
      {
        service: "root-cause-investigation",
        prerequisites: ["repository-intelligence"],
      },
    );
  });

  it("routes repository intelligence without recursive prerequisites", () => {
    assert.deepEqual(
      planRequest({ requestedService: "repository-intelligence" }),
      {
        service: "repository-intelligence",
        prerequisites: [],
      },
    );
  });

  it("routes pull request review without repository acquisition", () => {
    assert.deepEqual(
      planRequest({ requestedService: "pull-request-review" }),
      {
        service: "pull-request-review",
        prerequisites: [],
      },
    );
  });
});

describe("DeterministicIntentClassifier", () => {
  const classifier = new DeterministicIntentClassifier();

  for (const [request, expectedIntent] of [
    ["Audit this repository", "security-audit"],
    ["Find vulnerabilities in this GitHub repo", "security-audit"],
    ["Review this smart contract", "security-audit"],
    ["Why is my build failing?", "root-cause-investigation"],
    ["Fix this runtime error", "root-cause-investigation"],
    ["Investigate this stack trace", "root-cause-investigation"],
    ["Review my hackathon submission", "combined-analysis"],
    ["Analyze this repository", "combined-analysis"],
    [
      "Audit then explain why deployment failed",
      "combined-analysis",
    ],
    ["Show the repository structure", "repository-analysis"],
    ["Review this pull request", "pull-request-review"],
    ["Inspect PR #25", "pull-request-review"],
    ["Review this GitHub PR", "pull-request-review"],
  ]) {
    it(`classifies "${request}" as ${expectedIntent}`, () => {
      assert.equal(classifier.classify(request).intent, expectedIntent);
    });
  }
});

describe("ExecutionPlanner", () => {
  const planner = new ExecutionPlanner();

  it("resolves combined services in dependency order", () => {
    const plan = planner.createPlan(
      {
        intent: "combined-analysis",
        confidence: "high",
        matchedSignals: ["audit-then-investigate"],
        rationale: "combined",
      },
      true,
    );

    assert.deepEqual(
      plan.steps.map((step) => step.service),
      [
        "repository-intelligence",
        "security-audit",
        "root-cause-investigation",
      ],
    );
    assert.deepEqual(plan.omittedServices, []);
  });

  it("omits root cause from broad analysis when no logs exist", () => {
    const plan = planner.createPlan(
      {
        intent: "combined-analysis",
        confidence: "high",
        matchedSignals: ["analyze-repository"],
        rationale: "combined",
      },
      false,
    );

    assert.deepEqual(
      plan.steps.map((step) => step.service),
      ["repository-intelligence", "security-audit"],
    );
    assert.equal(
      plan.omittedServices[0].service,
      "root-cause-investigation",
    );
  });

  it("requires logs for an explicit root cause request", () => {
    assert.throws(
      () =>
        planner.createPlan(
          {
            intent: "root-cause-investigation",
            confidence: "medium",
            matchedSignals: ["build-failure"],
            rationale: "root cause",
          },
          false,
        ),
      /require at least one/i,
    );
  });

  it("creates a one-step pull request review plan", () => {
    const plan = planner.createPlan(
      {
        intent: "pull-request-review",
        confidence: "medium",
        matchedSignals: ["pull-request-review"],
        rationale: "pull request",
      },
      false,
    );

    assert.deepEqual(
      plan.steps.map((step) => step.service),
      ["pull-request-review"],
    );
    assert.deepEqual(plan.steps[0].prerequisites, []);
  });
});
