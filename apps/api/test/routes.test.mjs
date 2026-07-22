import assert from "node:assert/strict";
import { describe, it } from "node:test";

import pino from "pino";

import { createApp } from "../dist/app.js";
import { loadEnvironment } from "../dist/config/environment.js";

describe("HTTP routes", () => {
  it("serves health and placeholder service responses", async () => {
    const dispatcher = {
      async dispatch(service, request) {
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
          service,
          status: "not-implemented",
          requestId: request.requestId,
          message: "placeholder",
        };
      },
    };
    const app = createApp({
      dispatcher,
      environment: loadEnvironment({ NODE_ENV: "test" }),
      logger: pino({ enabled: false }),
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
      assert.equal(audit.status, 501);
      assert.deepEqual(
        {
          ...(await audit.json()),
          requestId: "ignored",
        },
        {
          service: "security-audit",
          status: "not-implemented",
          requestId: "ignored",
          message: "placeholder",
        },
      );
      assert.equal(repositorySummary.status, 200);
      assert.equal((await repositorySummary.json()).status, "completed");
      assert.equal(invalidRepositorySummary.status, 400);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
