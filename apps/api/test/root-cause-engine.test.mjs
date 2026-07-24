import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ConfigurationCauseDetector } from "../dist/investigation/root-cause/detectors/configuration-cause-detector.js";
import { DependencyCauseDetector } from "../dist/investigation/root-cause/detectors/dependency-cause-detector.js";
import { ExecutionCauseDetector } from "../dist/investigation/root-cause/detectors/execution-cause-detector.js";
import { SmartContractCauseDetector } from "../dist/investigation/root-cause/detectors/smart-contract-cause-detector.js";
import { LogNormalizer } from "../dist/investigation/root-cause/log-normalizer.js";
import { RootCauseEngine } from "../dist/investigation/root-cause/root-cause-engine.js";

describe("RootCauseEngine", () => {
  it("ranks a specific module-resolution cause above a generic build failure", () => {
    const result = createEngine().investigate(
      createModel({
        manifestContents: {
          "package.json": JSON.stringify({ dependencies: { express: "5.2.1" } }),
        },
        files: ["package.json", "apps/api/src/server.ts"],
      }),
      [
        {
          source: "build",
          content:
            "Error: Cannot find module 'express'\n    at apps/api/src/server.ts:1:1\nBuild failed",
        },
      ],
    );

    assert.equal(result.candidate.category, "module-resolution");
    assert.equal(result.candidate.relatedDependencies.includes("express"), true);
    assert.equal(
      result.candidate.relatedFiles.includes("apps/api/src/server.ts"),
      true,
    );
  });

  it("detects missing environment configuration and redacts supplied secrets", () => {
    const result = createEngine().investigate(
      createModel({
        environmentFiles: [".env.example"],
        configurationFiles: ["src/config.ts"],
        files: [".env.example", "src/config.ts"],
      }),
      [
        {
          source: "runtime",
          content:
            "DATABASE_URL is required password=super-secret-value",
        },
      ],
    );

    assert.equal(result.candidate.category, "missing-environment-variable");
    assert.equal(result.candidate.relatedFiles.includes(".env.example"), true);
    assert.match(result.entries[0].text, /password=\[REDACTED\]/);
    assert.equal(result.entries[0].text.includes("super-secret-value"), false);
  });

  it("detects database failures and only enables contract causes for Solidity repositories", () => {
    const database = createEngine().investigate(createModel(), [
      {
        source: "runtime",
        content: "ECONNREFUSED 127.0.0.1:5432 database startup failed",
      },
    ]);
    const nonSolidity = createEngine().investigate(createModel(), [
      { source: "runtime", content: "execution reverted during deployment" },
    ]);
    const solidity = createEngine().investigate(
      createModel({
        solidityDetected: true,
        solidityFiles: ["contracts/Vault.sol"],
        files: ["contracts/Vault.sol"],
      }),
      [{ source: "runtime", content: "execution reverted during deployment" }],
    );

    assert.equal(database.candidate.category, "database-connection-failure");
    assert.equal(nonSolidity.candidate.category, "undetermined");
    assert.equal(
      solidity.candidate.category,
      "smart-contract-deployment-failure",
    );
    assert.equal(
      solidity.candidate.relatedFiles.includes("contracts/Vault.sol"),
      true,
    );
  });

  it("returns a cautious fallback when no supported signature exists", () => {
    const result = createEngine().investigate(createModel(), [
      { source: "runtime", content: "worker stopped for an unknown reason" },
    ]);

    assert.equal(result.candidate.category, "undetermined");
    assert.equal(result.candidate.score, 15);
    assert.match(result.candidate.summary, /does not contain a supported/i);
  });
});

function createEngine() {
  return new RootCauseEngine(new LogNormalizer(5_000), [
    new DependencyCauseDetector(),
    new ConfigurationCauseDetector(),
    new ExecutionCauseDetector(),
    new SmartContractCauseDetector(),
  ]);
}

function createModel(options = {}) {
  const identity = {
    name: "fixture",
    owner: "adam",
    url: "https://github.com/adam/fixture",
    defaultBranch: "main",
    commitSha: "abc123",
  };
  const paths = options.files ?? ["src/index.ts"];

  return {
    identity,
    rootDirectory: "fixture",
    files: paths.map((path) => ({
      path,
      extension: path.includes(".") ? path.slice(path.lastIndexOf(".")) : "",
      sizeBytes: 0,
      content: "",
    })),
    directories: [],
    topLevelEntries: [],
    manifestContents: options.manifestContents ?? {},
    analysisLimitations: [],
    summary: {
      repository: identity,
      languages: [],
      frameworks: [],
      packageManager: { name: "pnpm", confidence: "high", evidence: [] },
      structure: {
        topLevelEntries: [],
        directories: [],
        fileTree: paths,
      },
      docker: { detected: false, files: [] },
      ciCd: { detected: false, files: [] },
      smartContracts: {
        detected: options.solidityDetected ?? false,
        solidityFiles: options.solidityFiles ?? [],
      },
      environmentFiles: options.environmentFiles ?? [],
      configurationFiles: options.configurationFiles ?? [],
      totalFilesScanned: paths.length,
      ignoredDirectories: [],
      limitations: [],
    },
  };
}
