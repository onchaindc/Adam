import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseGitHubRepositoryUrl } from "../dist/platform/github/github-repository.js";

describe("parseGitHubRepositoryUrl", () => {
  it("normalizes a public GitHub HTTPS URL", () => {
    assert.deepEqual(
      parseGitHubRepositoryUrl("https://github.com/onchaindc/Adam"),
      {
        owner: "onchaindc",
        name: "Adam",
        canonicalUrl: "https://github.com/onchaindc/Adam.git",
      },
    );
  });

  it("rejects credentials, unsupported hosts, and nested paths", () => {
    for (const repositoryUrl of [
      "https://token@github.com/onchaindc/Adam",
      "http://github.com/onchaindc/Adam",
      "https://gitlab.com/onchaindc/Adam",
      "https://github.com/onchaindc/Adam/tree/main",
    ]) {
      assert.throws(
        () => parseGitHubRepositoryUrl(repositoryUrl),
        (error) => error.code === "invalid-repository-url",
      );
    }
  });
});
