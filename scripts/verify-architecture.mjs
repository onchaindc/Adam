import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = new URL("../", import.meta.url);
const apiSource = new URL("../apps/api/src/", import.meta.url);
const violations = [];

const sourceFiles = await collectTypeScriptFiles(apiSource);

for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  const displayPath = relative(root.pathname, file.pathname).replaceAll("\\", "/");

  if (
    displayPath.includes("/planner/") &&
    /from\s+["'][^"']*(services|transport)\//.test(source)
  ) {
    violations.push(`${displayPath}: planner imports an execution layer`);
  }

  if (
    displayPath.includes("/services/") &&
    /from\s+["'][^"']*transport\//.test(source)
  ) {
    violations.push(`${displayPath}: service imports transport code`);
  }
}

const forbiddenSprintOnePaths = [
  "apps/api/src/analyzers",
  "apps/api/src/investigation/repository",
  "apps/api/src/platform/github",
  "apps/api/src/reporting",
];

for (const path of forbiddenSprintOnePaths) {
  try {
    await readdir(new URL(`../${path}/`, import.meta.url));
    violations.push(`${path}: Sprint 2+ module exists during Sprint 1`);
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture verification failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Architecture verification passed (${sourceFiles.length} TypeScript files checked).`);

async function collectTypeScriptFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directoryUrl);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(entryUrl)));
    } else if (extname(entry.name) === ".ts") {
      files.push(entryUrl);
    }
  }

  return files;
}
