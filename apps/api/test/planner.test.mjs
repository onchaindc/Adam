import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planRequest } from "../dist/planner/planner.js";

describe("planRequest", () => {
  it("routes security audit requests", () => {
    assert.deepEqual(planRequest({ requestedService: "security-audit" }), {
      service: "security-audit",
    });
  });

  it("routes root cause investigation requests", () => {
    assert.deepEqual(
      planRequest({ requestedService: "root-cause-investigation" }),
      {
        service: "root-cause-investigation",
      },
    );
  });
});
