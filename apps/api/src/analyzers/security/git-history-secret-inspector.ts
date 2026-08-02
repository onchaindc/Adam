import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import type { GitHistorySecretAnalysis } from "@adam/contracts";

import type { RepositoryModel } from "../../investigation/repository/model.js";
import {
  detectSecretsInLine,
} from "./secrets-scanner.js";
import { redactAssignment } from "./source-utils.js";
import type { SecurityFindingCandidate } from "./types.js";

export interface GitHistorySecretInspection {
  readonly findings: readonly SecurityFindingCandidate[];
  readonly limitations: readonly string[];
  readonly summary: GitHistorySecretAnalysis;
}

export interface GitHistorySecretInspector {
  inspect(model: RepositoryModel): Promise<GitHistorySecretInspection>;
}

export interface GitHistorySecretInspectorOptions {
  readonly maxCommits: number;
  readonly timeoutMs: number;
  readonly maxPatchBytes: number;
}

interface GitLogResult {
  readonly output: string;
  readonly truncated: boolean;
}

export class DefaultGitHistorySecretInspector
  implements GitHistorySecretInspector
{
  public constructor(
    private readonly options: GitHistorySecretInspectorOptions,
  ) {}

  public async inspect(
    model: RepositoryModel,
  ): Promise<GitHistorySecretInspection> {
    try {
      const log = await readGitLog(model.rootDirectory, this.options);
      const parsed = parseGitHistory(log.output);
      const shallow = existsSync(
        join(model.rootDirectory, ".git", "shallow"),
      );
      const partial = shallow || log.truncated;
      const limitation = historyLimitation({
        partial,
        truncated: log.truncated,
        maxCommits: this.options.maxCommits,
      });

      return {
        findings: parsed.findings,
        limitations: [limitation],
        summary: {
          status: partial ? "partial" : "completed",
          commitsScanned: parsed.commitsScanned,
          findingsFound: parsed.findings.length,
          depthLimit: this.options.maxCommits,
          limitation,
        },
      };
    } catch {
      const limitation =
        "Git-history secret scanning failed; Adam continued with the current repository snapshot.";
      return {
        findings: [],
        limitations: [limitation],
        summary: {
          status: "failed",
          commitsScanned: 0,
          findingsFound: 0,
          depthLimit: this.options.maxCommits,
          limitation,
        },
      };
    }
  }
}

export function notRequestedGitHistorySecrets(
  depthLimit = 0,
): GitHistorySecretAnalysis {
  return {
    status: "not-requested",
    commitsScanned: 0,
    findingsFound: 0,
    depthLimit,
    limitation: null,
  };
}

function parseGitHistory(output: string): {
  readonly commitsScanned: number;
  readonly findings: readonly SecurityFindingCandidate[];
} {
  const findings: SecurityFindingCandidate[] = [];
  const seen = new Set<string>();
  let commit = "";
  let path = "";
  let newLine: number | null = null;
  let commitsScanned = 0;

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith("ADAM_COMMIT:")) {
      commit = line.slice("ADAM_COMMIT:".length).trim();
      path = "";
      newLine = null;
      commitsScanned += 1;
      continue;
    }
    if (line.startsWith("+++ ")) {
      const value = line.slice(4);
      path = value === "/dev/null"
        ? ""
        : value.startsWith("b/")
          ? value.slice(2)
          : value;
      continue;
    }

    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk?.[1]) {
      newLine = Number.parseInt(hunk[1], 10);
      continue;
    }
    if (newLine === null || !path || !commit) {
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const source = line.slice(1);
      for (const detection of detectSecretsInLine(path, source)) {
        const ruleId = `HISTORY-${detection.ruleId}`;
        const key = [
          commit,
          path,
          newLine,
          ruleId,
          redactAssignment(source),
        ].join(":");
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        findings.push({
          ruleId,
          category: "secrets",
          title: `Secret recoverable from Git history: ${detection.title}`,
          severity: detection.severity,
          file: path,
          line: newLine,
          description:
            `Commit ${commit.slice(0, 12)} introduced a value matching a credential pattern. Removing it from a later revision does not remove it from Git history.`,
          evidence:
            `${commit.slice(0, 12)}: ${redactAssignment(source)}`,
          confidence: detection.confidence,
        });
      }
      newLine += 1;
      continue;
    }
    if (!line.startsWith("-") && !line.startsWith("\\")) {
      newLine += 1;
    }
  }

  return { commitsScanned, findings };
}

function readGitLog(
  cwd: string,
  options: GitHistorySecretInspectorOptions,
): Promise<GitLogResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "git",
      [
        "-c",
        "core.quotePath=false",
        "log",
        `--max-count=${options.maxCommits}`,
        "--format=ADAM_COMMIT:%H",
        "--patch",
        "--unified=0",
        "--no-renames",
        "--no-color",
        "--no-ext-diff",
        "--no-textconv",
        "HEAD",
      ],
      {
        cwd,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
          GCM_INTERACTIVE: "never",
        },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    let output = "";
    let errorOutput = "";
    let settled = false;
    let truncated = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error("Git-history scan timed out."));
      }
    }, options.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (truncated) {
        return;
      }
      output += chunk.toString("utf8");
      if (Buffer.byteLength(output) > options.maxPatchBytes) {
        truncated = true;
        child.kill();
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString("utf8");
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (settled) {
        return;
      }
      settled = true;
      if (code === 0 || truncated) {
        resolve({ output, truncated });
      } else {
        reject(new Error(errorOutput || "Git-history scan failed."));
      }
    });
  });
}

function historyLimitation(input: {
  readonly partial: boolean;
  readonly truncated: boolean;
  readonly maxCommits: number;
}): string {
  if (input.truncated) {
    return "Git-history secret scanning reached the configured patch-byte limit and analyzed a partial current-branch history.";
  }
  if (input.partial) {
    return `Git-history secret scanning is bounded to the most recent ${input.maxCommits} commits on the acquired default branch; older commits, other branches, forks, and cached copies are not covered.`;
  }
  return "Git-history secret scanning covered the acquired default branch only; other branches, forks, and cached copies are not covered.";
}
