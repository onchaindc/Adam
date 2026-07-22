import { readFile, readdir } from "node:fs/promises";
import { extname } from "node:path";

const root = new URL("../", import.meta.url);
const ignoredDirectories = new Set([
  ".data",
  ".git",
  ".pnpm-store",
  "dist",
  "node_modules",
]);
const checkedExtensions = new Set([
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".yaml",
  ".yml",
]);
const violations = [];

for (const file of await collectFiles(root)) {
  if (!checkedExtensions.has(extname(file.pathname))) {
    continue;
  }

  const content = await readFile(file, "utf8");
  if (!content.endsWith("\n")) {
    violations.push(`${file.pathname}: missing final newline`);
  }

  for (const [index, line] of content.split("\n").entries()) {
    if (/[ \t]+$/.test(line)) {
      violations.push(`${file.pathname}:${index + 1}: trailing whitespace`);
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("Format verification passed.");

async function collectFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }

    const entryUrl = new URL(
      `${entry.name}${entry.isDirectory() ? "/" : ""}`,
      directoryUrl,
    );
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryUrl)));
    } else {
      files.push(entryUrl);
    }
  }

  return files;
}
