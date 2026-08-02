import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { DefaultGitHistorySecretInspector } from "../dist/analyzers/security/git-history-secret-inspector.js";
import { LiveVulnerabilityInspector } from "../dist/analyzers/security/live-vulnerability-inspector.js";
import { extractPackageCoordinates } from "../dist/analyzers/security/package-coordinate-extractor.js";
import { OsvClient } from "../dist/platform/osv/osv-client.js";
import { DockerRuntimeAnalyzer } from "../dist/runtime/docker-runtime-analyzer.js";
import { SecurityEnrichmentEngine } from "../dist/services/security-enrichment-engine.js";

describe("security enrichment", () => {
  it("extracts exact pnpm lockfile coordinates", () => {
    const model = createModel({
      "pnpm-lock.yaml": [
        "lockfileVersion: '9.0'",
        "packages:",
        "  lodash@4.17.20: {}",
        "  '@scope/example@2.3.4': {}",
      ].join("\n"),
    });

    const result = extractPackageCoordinates(model);

    assert.deepEqual(
      result.packages.map(({ ecosystem, name, version }) => ({
        ecosystem,
        name,
        version,
      })),
      [
        { ecosystem: "npm", name: "@scope/example", version: "2.3.4" },
        { ecosystem: "npm", name: "lodash", version: "4.17.20" },
      ],
    );
  });

  it("queries OSV in a batch and resolves advisory details", async () => {
    const requests = [];
    const client = new OsvClient({
      baseUrl: "https://api.osv.test",
      timeoutMs: 1_000,
      maxAdvisories: 10,
      async fetch(url, init) {
        requests.push({ url: String(url), init });
        if (String(url).endsWith("/v1/querybatch")) {
          return Response.json({
            results: [{ vulns: [{ id: "GHSA-fixture" }] }],
          });
        }
        return Response.json({
          id: "GHSA-fixture",
          summary: "Fixture advisory",
          database_specific: { severity: "HIGH" },
        });
      },
    });

    const advisories = await client.queryPackages([
      {
        ecosystem: "npm",
        name: "fixture",
        version: "1.0.0",
        sourceFile: "pnpm-lock.yaml",
      },
    ]);

    assert.equal(requests.length, 2);
    assert.equal(advisories.length, 1);
    assert.equal(advisories[0].vulnerability.id, "GHSA-fixture");
  });

  it("converts live advisories into dependency findings", async () => {
    const model = createModel({
      "pnpm-lock.yaml": [
        "lockfileVersion: '9.0'",
        "packages:",
        "  lodash@4.17.20: {}",
      ].join("\n"),
    });
    const inspector = new LiveVulnerabilityInspector(
      {
        async queryPackages(packages) {
          assert.equal(packages[0].name, "lodash");
          return [
            {
              package: packages[0],
              vulnerability: {
                id: "GHSA-test",
                summary: "Known lodash issue",
                database_specific: { severity: "HIGH" },
              },
            },
          ];
        },
      },
      { maxPackages: 100, now: () => new Date("2026-07-29T00:00:00Z") },
    );

    const result = await inspector.inspect(model);

    assert.equal(result.summary.status, "completed");
    assert.equal(result.summary.packagesChecked, 1);
    assert.equal(result.summary.advisoriesFound, 1);
    assert.equal(result.findings[0].ruleId, "DEP-OSV-GHSA-TEST");
    assert.equal(result.findings[0].severity, "high");
  });

  it("keeps static analysis offline and only runs the sandbox when requested", async () => {
    let liveCalls = 0;
    let historyCalls = 0;
    let runtimeCalls = 0;
    const engine = new SecurityEnrichmentEngine(
      {
        async inspect() {
          liveCalls += 1;
          return {
            findings: [],
            limitations: [],
            summary: {
              status: "completed",
              provider: "OSV",
              queriedAt: "2026-07-29T00:00:00.000Z",
              packagesChecked: 1,
              advisoriesFound: 0,
              limitation: null,
            },
          };
        },
      },
      {
        async analyze() {
          runtimeCalls += 1;
          return {
            status: "completed",
            sandbox: "docker",
            checks: [],
            limitation: null,
          };
        },
      },
      {
        async inspect() {
          historyCalls += 1;
          return {
            findings: [],
            limitations: [],
            summary: {
              status: "completed",
              commitsScanned: 2,
              findingsFound: 0,
              depthLimit: 10,
              limitation: null,
            },
          };
        },
      },
    );
    const model = createModel({});

    await engine.analyze(model, "static");
    assert.equal(liveCalls, 0);
    assert.equal(historyCalls, 0);
    assert.equal(runtimeCalls, 0);

    await engine.analyze(model, "live");
    assert.equal(liveCalls, 1);
    assert.equal(historyCalls, 1);
    assert.equal(runtimeCalls, 0);

    await engine.analyze(model, "sandboxed");
    assert.equal(liveCalls, 2);
    assert.equal(historyCalls, 2);
    assert.equal(runtimeCalls, 1);
  });

  it("finds a secret removed from the current Git snapshot", async () => {
    const root = await mkdtemp(join(tmpdir(), "adam-history-test-"));
    const secret = "history-only-sensitive-value-12345";

    try {
      git(root, "init");
      git(root, "config", "user.email", "adam@example.test");
      git(root, "config", "user.name", "Adam Test");
      await writeFile(join(root, ".env"), `PRIVATE_KEY=${secret}\n`);
      git(root, "add", ".env");
      git(root, "commit", "-m", "add test value");
      await writeFile(join(root, ".env"), "PRIVATE_KEY=\n");
      git(root, "add", ".env");
      git(root, "commit", "-m", "remove test value");

      const inspector = new DefaultGitHistorySecretInspector({
        maxCommits: 10,
        timeoutMs: 10_000,
        maxPatchBytes: 1_000_000,
      });
      const result = await inspector.inspect({
        ...createModel({}),
        rootDirectory: root,
      });

      assert.equal(result.summary.status, "completed");
      assert.equal(result.summary.commitsScanned, 2);
      assert.equal(result.summary.findingsFound, 1);
      assert.equal(
        result.findings[0].ruleId,
        "HISTORY-SEC-POPULATED-ENV-SECRET",
      );
      assert.equal(result.findings[0].file, ".env");
      assert.match(result.findings[0].evidence, /\[REDACTED\]/);
      assert.equal(result.findings[0].evidence.includes(secret), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("refuses host execution when the Docker sandbox is disabled", async () => {
    const analyzer = new DockerRuntimeAnalyzer({
      enabled: false,
      image: "node:24-bookworm-slim",
      timeoutMs: 30_000,
      memoryMb: 512,
      cpus: 1,
      pidsLimit: 64,
      maxPackages: 2,
    });

    const result = await analyzer.analyze(createModel({}));

    assert.equal(result.status, "skipped");
    assert.match(result.limitation, /disabled/i);
    assert.deepEqual(result.checks, []);
  });
});

function createModel(manifestContents) {
  const identity = {
    name: "fixture",
    owner: "adam",
    url: "https://github.com/adam/fixture",
    defaultBranch: "main",
    commitSha: "abc123",
  };
  return {
    identity,
    rootDirectory: "fixture",
    files: [],
    directories: [],
    topLevelEntries: [],
    manifestContents,
    analysisLimitations: [],
    summary: {
      repository: identity,
      languages: [],
      detectedLanguages: [],
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

function git(cwd, ...args) {
  execFileSync("git", args, {
    cwd,
    stdio: "ignore",
    windowsHide: true,
  });
}
