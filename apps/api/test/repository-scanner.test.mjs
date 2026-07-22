import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { RepositoryScanner } from "../dist/investigation/repository/repository-scanner.js";

describe("RepositoryScanner", () => {
  it("builds a bounded repository model and ignores generated directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "adam-scanner-test-"));

    try {
      await Promise.all([
        mkdir(join(root, ".github", "workflows"), { recursive: true }),
        mkdir(join(root, "contracts"), { recursive: true }),
        mkdir(join(root, "src"), { recursive: true }),
        mkdir(join(root, "node_modules", "ignored"), { recursive: true }),
      ]);
      await Promise.all([
        writeFile(
          join(root, "package.json"),
          JSON.stringify({
            dependencies: { next: "15.0.0", react: "19.0.0" },
          }),
        ),
        writeFile(join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n"),
        writeFile(join(root, "next.config.ts"), "export default {};\n"),
        writeFile(join(root, "Dockerfile"), "FROM node:24\n"),
        writeFile(join(root, ".env.example"), "TOKEN=\n"),
        writeFile(join(root, ".github", "workflows", "ci.yml"), "name: CI\n"),
        writeFile(join(root, "contracts", "Vault.sol"), "pragma solidity ^0.8.0;\n"),
        writeFile(join(root, "src", "page.tsx"), "export default function Page() {}\n"),
        writeFile(
          join(root, "node_modules", "ignored", "index.js"),
          "throw new Error('must not scan');\n",
        ),
      ]);

      const model = await new RepositoryScanner({
        maxFiles: 100,
        maxDepth: 10,
      }).scan(root, {
        name: "fixture",
        owner: "adam",
        url: "https://github.com/adam/fixture",
        defaultBranch: "main",
        commitSha: "abc123",
      });

      assert.equal(model.summary.repository.name, "fixture");
      assert.equal(model.summary.packageManager.name, "pnpm");
      assert.deepEqual(
        model.summary.frameworks.map((framework) => framework.name),
        ["Next.js", "React", "Solidity"],
      );
      assert.equal(model.summary.docker.detected, true);
      assert.equal(model.summary.ciCd.detected, true);
      assert.equal(model.summary.smartContracts.detected, true);
      assert.deepEqual(model.summary.environmentFiles, [".env.example"]);
      assert.equal(model.summary.totalFilesScanned, 8);
      assert.equal(
        model.summary.structure.fileTree.some((path) =>
          path.startsWith("node_modules/"),
        ),
        false,
      );
      assert.equal(
        model.summary.structure.topLevelEntries.includes("node_modules"),
        false,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("enforces the configured file limit", async () => {
    const root = await mkdtemp(join(tmpdir(), "adam-scanner-limit-test-"));

    try {
      await Promise.all([
        writeFile(join(root, "one.ts"), ""),
        writeFile(join(root, "two.ts"), ""),
      ]);

      await assert.rejects(
        new RepositoryScanner({ maxFiles: 1, maxDepth: 10 }).scan(root, {
          name: "fixture",
          owner: "adam",
          url: "https://github.com/adam/fixture",
          defaultBranch: "main",
          commitSha: "abc123",
        }),
        (error) => error.code === "repository-limit-exceeded",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
