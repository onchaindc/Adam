import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { FileRuntimeStateStore } from "../dist/platform/state/runtime-state.js";

describe("FileRuntimeStateStore", () => {
  it("persists instance identity and increments the boot counter", async () => {
    const directory = await mkdtemp(join(tmpdir(), "adam-state-"));

    try {
      const filePath = join(directory, "runtime-state.json");
      const store = new FileRuntimeStateStore(filePath);
      const first = await store.initialize();
      const second = await store.initialize();

      assert.equal(second.instanceId, first.instanceId);
      assert.equal(second.bootCount, 2);
      assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), second);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
