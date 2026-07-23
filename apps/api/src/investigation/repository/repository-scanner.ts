import { lstat, readFile, readdir } from "node:fs/promises";
import { extname, join, sep } from "node:path";

import type { RepositorySummary } from "@adam/contracts";

import { detectStack } from "../stack/stack-detector.js";
import { RepositoryIntelligenceError } from "./errors.js";
import type {
  RepositoryFile,
  RepositoryIdentity,
  RepositoryModel,
} from "./model.js";

export const IGNORED_REPOSITORY_DIRECTORIES = [
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "vendor",
  "target",
  ".git",
] as const;

const ignoredDirectories = new Set<string>(IGNORED_REPOSITORY_DIRECTORIES);
const manifestFilenames = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "cargo.toml",
  "go.mod",
]);
const MAX_MANIFEST_BYTES = 1_000_000;
const inspectableExtensions = new Set([
  ".c",
  ".cjs",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".h",
  ".hpp",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".md",
  ".mjs",
  ".php",
  ".properties",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sol",
  ".swift",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".yaml",
  ".yml",
]);

export interface RepositoryScannerOptions {
  readonly maxFiles: number;
  readonly maxDepth: number;
  readonly maxFileBytes: number;
  readonly maxTotalSourceBytes: number;
}

export class RepositoryScanner {
  public constructor(private readonly options: RepositoryScannerOptions) {}

  public async scan(
    rootDirectory: string,
    identity: RepositoryIdentity,
  ): Promise<RepositoryModel> {
    const files: RepositoryFile[] = [];
    const directories: string[] = [];
    const manifestContents: Record<string, string> = {};
    let totalSourceBytes = 0;
    let oversizedTextFiles = 0;
    let sourceBudgetSkippedFiles = 0;
    const topLevelEntries = (await readdir(rootDirectory))
      .filter((entry) => !ignoredDirectories.has(entry))
      .sort();
    const queue = [{ absolutePath: rootDirectory, relativePath: "", depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      const entries = await readdir(current.absolutePath, {
        withFileTypes: true,
      });
      entries.sort((left, right) => left.name.localeCompare(right.name));

      for (const entry of entries) {
        const relativePath = normalizePath(
          join(current.relativePath, entry.name),
        );
        const absolutePath = join(current.absolutePath, entry.name);

        if (entry.isDirectory()) {
          if (ignoredDirectories.has(entry.name)) {
            continue;
          }
          if (current.depth + 1 > this.options.maxDepth) {
            throw new RepositoryIntelligenceError(
              "repository-limit-exceeded",
              `Repository directory depth exceeds ${this.options.maxDepth}.`,
            );
          }

          directories.push(relativePath);
          queue.push({
            absolutePath,
            relativePath,
            depth: current.depth + 1,
          });
          continue;
        }

        const stats = await lstat(absolutePath);
        const extension = extname(entry.name).toLowerCase();
        let content: string | null = null;

        if (stats.isFile() && isInspectableText(entry.name, extension)) {
          if (stats.size > this.options.maxFileBytes) {
            oversizedTextFiles += 1;
          } else if (
            totalSourceBytes + stats.size >
            this.options.maxTotalSourceBytes
          ) {
            sourceBudgetSkippedFiles += 1;
          } else {
            const buffer = await readFile(absolutePath);
            if (!buffer.includes(0)) {
              content = buffer.toString("utf8");
              totalSourceBytes += stats.size;
            }
          }
        }

        files.push({
          path: relativePath,
          extension,
          sizeBytes: stats.size,
          content,
        });

        if (files.length > this.options.maxFiles) {
          throw new RepositoryIntelligenceError(
            "repository-limit-exceeded",
            `Repository contains more than ${this.options.maxFiles} scannable files.`,
          );
        }

        if (
          stats.isFile() &&
          stats.size <= MAX_MANIFEST_BYTES &&
          manifestFilenames.has(entry.name.toLowerCase())
        ) {
          manifestContents[relativePath] =
            content ?? (await readFile(absolutePath, "utf8"));
        }
      }
    }

    const stack = detectStack(files, manifestContents);
    const analysisLimitations = [...stack.limitations];
    if (oversizedTextFiles > 0) {
      analysisLimitations.push(
        `${oversizedTextFiles} text files exceeded the per-file inspection limit.`,
      );
    }
    if (sourceBudgetSkippedFiles > 0) {
      analysisLimitations.push(
        `${sourceBudgetSkippedFiles} text files exceeded the total source inspection budget.`,
      );
    }
    const fileTree = files.map((file) => file.path);
    const dockerFiles = fileTree.filter(isDockerFile);
    const ciCdFiles = fileTree.filter(isCiCdFile);
    const solidityFiles = fileTree.filter((path) =>
      path.toLowerCase().endsWith(".sol"),
    );
    const environmentFiles = fileTree.filter(isEnvironmentFile);
    const configurationFiles = fileTree.filter(isConfigurationFile);
    const summary: RepositorySummary = {
      repository: identity,
      languages: stack.languages,
      frameworks: stack.frameworks,
      packageManager: stack.packageManager,
      structure: {
        topLevelEntries,
        directories,
        fileTree,
      },
      docker: {
        detected: dockerFiles.length > 0,
        files: dockerFiles,
      },
      ciCd: {
        detected: ciCdFiles.length > 0,
        files: ciCdFiles,
      },
      smartContracts: {
        detected: solidityFiles.length > 0,
        solidityFiles,
      },
      environmentFiles,
      configurationFiles,
      totalFilesScanned: files.length,
      ignoredDirectories: IGNORED_REPOSITORY_DIRECTORIES,
      limitations: analysisLimitations,
    };

    return {
      identity,
      rootDirectory,
      files,
      directories,
      topLevelEntries,
      manifestContents,
      analysisLimitations,
      summary,
    };
  }
}

function isInspectableText(filename: string, extension: string): boolean {
  const lowerFilename = filename.toLowerCase();
  return (
    inspectableExtensions.has(extension) ||
    lowerFilename === "dockerfile" ||
    lowerFilename === "jenkinsfile" ||
    lowerFilename.startsWith(".env") ||
    lowerFilename.endsWith("rc")
  );
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function isDockerFile(path: string): boolean {
  const filename = path.split("/").at(-1)?.toLowerCase() ?? "";
  return (
    filename === "dockerfile" ||
    filename.startsWith("dockerfile.") ||
    /(^|\/)docker-compose(\.[^.]+)?\.ya?ml$/.test(path.toLowerCase()) ||
    /(^|\/)compose(\.[^.]+)?\.ya?ml$/.test(path.toLowerCase())
  );
}

function isCiCdFile(path: string): boolean {
  const lowerPath = path.toLowerCase();
  const filename = lowerPath.split("/").at(-1) ?? "";
  return (
    lowerPath.startsWith(".github/workflows/") ||
    lowerPath.startsWith(".circleci/") ||
    filename === ".gitlab-ci.yml" ||
    filename === "jenkinsfile" ||
    filename === "azure-pipelines.yml" ||
    filename === "bitbucket-pipelines.yml"
  );
}

function isEnvironmentFile(path: string): boolean {
  const filename = path.split("/").at(-1)?.toLowerCase() ?? "";
  return filename === ".env" || filename.startsWith(".env.");
}

function isConfigurationFile(path: string): boolean {
  const filename = path.split("/").at(-1)?.toLowerCase() ?? "";
  if (isEnvironmentFile(path)) {
    return false;
  }

  return (
    filename.endsWith(".config.js") ||
    filename.endsWith(".config.cjs") ||
    filename.endsWith(".config.mjs") ||
    filename.endsWith(".config.ts") ||
    filename.endsWith(".toml") ||
    filename.endsWith(".yaml") ||
    filename.endsWith(".yml") ||
    filename === "tsconfig.json" ||
    filename === "jsconfig.json" ||
    filename === "package.json" ||
    filename === "go.mod" ||
    filename === "cargo.toml" ||
    filename === "pyproject.toml"
  );
}
