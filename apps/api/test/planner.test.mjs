import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
});
