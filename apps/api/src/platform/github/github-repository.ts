import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";

import { RepositoryIntelligenceError } from "../../investigation/repository/errors.js";

export interface GitHubRepositoryReference {
  readonly owner: string;
  readonly name: string;
  readonly canonicalUrl: string;
}

export interface AcquiredRepository {
  readonly reference: GitHubRepositoryReference;
  readonly directory: string;
  readonly defaultBranch: string;
  readonly commitSha: string;
  cleanup(): Promise<void>;
}

export interface GitHubRepositoryAcquirerOptions {
  readonly cloneTimeoutMs: number;
}

export class GitHubRepositoryAcquirer {
  public constructor(
    private readonly options: GitHubRepositoryAcquirerOptions,
  ) {}

  public async acquire(repositoryUrl: string): Promise<AcquiredRepository> {
    const reference = parseGitHubRepositoryUrl(repositoryUrl);
    const workspace = await mkdtemp(join(tmpdir(), "adam-repository-"));
    const repositoryDirectory = join(workspace, "repository");
    const hooksDirectory = join(workspace, "hooks-disabled");

    await mkdir(hooksDirectory);

    try {
      await runGit(
        [
          "-c",
          `core.hooksPath=${hooksDirectory}`,
          "-c",
          "credential.helper=",
          "clone",
          "--depth=1",
          "--single-branch",
          "--no-tags",
          "--",
          reference.canonicalUrl,
          repositoryDirectory,
        ],
        workspace,
        this.options.cloneTimeoutMs,
      );

      const [defaultBranch, commitSha] = await Promise.all([
        resolveDefaultBranch(repositoryDirectory, this.options.cloneTimeoutMs),
        runGit(
          ["rev-parse", "HEAD"],
          repositoryDirectory,
          this.options.cloneTimeoutMs,
        ),
      ]);

      return {
        reference,
        directory: repositoryDirectory,
        defaultBranch: defaultBranch.trim(),
        commitSha: commitSha.trim(),
        cleanup: () => removeWorkspace(workspace),
      };
    } catch (error) {
      await removeWorkspace(workspace);
      if (error instanceof RepositoryIntelligenceError) {
        throw error;
      }

      throw new RepositoryIntelligenceError(
        "repository-unavailable",
        "The public GitHub repository could not be retrieved.",
        { cause: error },
      );
    }
  }
}

export function parseGitHubRepositoryUrl(
  repositoryUrl: string,
): GitHubRepositoryReference {
  let parsed: URL;

  try {
    parsed = new URL(repositoryUrl);
  } catch (error) {
    throw new RepositoryIntelligenceError(
      "invalid-repository-url",
      "repositoryUrl must be a valid HTTPS GitHub repository URL.",
      { cause: error },
    );
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== "github.com" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new RepositoryIntelligenceError(
      "invalid-repository-url",
      "Only credential-free HTTPS URLs on github.com are supported.",
    );
  }

  let segments: string[];
  try {
    segments = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch (error) {
    throw new RepositoryIntelligenceError(
      "invalid-repository-url",
      "repositoryUrl contains invalid URL encoding.",
      { cause: error },
    );
  }

  if (segments.length !== 2) {
    throw new RepositoryIntelligenceError(
      "invalid-repository-url",
      "repositoryUrl must identify one GitHub owner and repository.",
    );
  }

  const owner = segments[0];
  const rawName = segments[1];
  if (!owner || !rawName) {
    throw new RepositoryIntelligenceError(
      "invalid-repository-url",
      "repositoryUrl must include a GitHub owner and repository.",
    );
  }

  const name = rawName.endsWith(".git") ? rawName.slice(0, -4) : rawName;
  const validSegment = /^[A-Za-z0-9_.-]+$/;
  if (!name || !validSegment.test(owner) || !validSegment.test(name)) {
    throw new RepositoryIntelligenceError(
      "invalid-repository-url",
      "repositoryUrl contains an unsupported owner or repository name.",
    );
  }

  return {
    owner,
    name,
    canonicalUrl: `https://github.com/${owner}/${name}.git`,
  };
}

async function resolveDefaultBranch(
  repositoryDirectory: string,
  timeoutMs: number,
): Promise<string> {
  try {
    const remoteHead = await runGit(
      ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
      repositoryDirectory,
      timeoutMs,
    );
    return basename(remoteHead.trim());
  } catch {
    return runGit(
      ["branch", "--show-current"],
      repositoryDirectory,
      timeoutMs,
    );
  }
}

async function runGit(
  args: readonly string[],
  cwd: string,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GCM_INTERACTIVE: "never",
      },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      settled = true;
      child.kill();
      reject(
        new RepositoryIntelligenceError(
          "repository-unavailable",
          "GitHub repository retrieval timed out.",
        ),
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(
          new RepositoryIntelligenceError(
            "repository-unavailable",
            "Git is unavailable or the repository could not be retrieved.",
            { cause: error },
          ),
        );
      }
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (settled) {
        return;
      }
      settled = true;

      if (code === 0) {
        resolvePromise(stdout);
        return;
      }

      reject(
        new RepositoryIntelligenceError(
          "repository-unavailable",
          sanitizeGitError(stderr),
        ),
      );
    });
  });
}

function sanitizeGitError(stderr: string): string {
  if (/not found|repository not found|authentication failed/i.test(stderr)) {
    return "The GitHub repository was not found or is not public.";
  }
  return "The public GitHub repository could not be retrieved.";
}

async function removeWorkspace(workspace: string): Promise<void> {
  const resolvedWorkspace = resolve(workspace);
  const allowedRoot = `${resolve(tmpdir())}${sep}`;

  if (!resolvedWorkspace.startsWith(allowedRoot)) {
    throw new Error(
      "Refusing to remove a workspace outside the system temp directory.",
    );
  }

  await rm(resolvedWorkspace, { recursive: true, force: true });
}
