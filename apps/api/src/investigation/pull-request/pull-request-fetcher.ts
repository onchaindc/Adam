import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

import type {
  PullRequestChangedFile,
  PullRequestFileStatus,
  PullRequestMetadata,
} from "@adam/contracts";

import { PullRequestReviewError } from "./errors.js";
import { parsePullRequestReference } from "./pull-request-reference.js";
import type {
  AcquiredPullRequest,
  PullRequestInput,
  PullRequestReference,
} from "./types.js";

interface PullRequestFetcherOptions {
  readonly token?: string;
  readonly timeoutMs: number;
  readonly maxFiles: number;
  readonly maxFileBytes: number;
  readonly maxTotalSourceBytes: number;
  readonly maxPatchBytes: number;
  readonly fetchImplementation?: typeof fetch;
}

interface GitHubPullRequestResponse {
  readonly number: number;
  readonly html_url: string;
  readonly title: string;
  readonly body: string | null;
  readonly state: "open" | "closed";
  readonly draft: boolean;
  readonly commits: number;
  readonly changed_files: number;
  readonly additions: number;
  readonly deletions: number;
  readonly user: { readonly login: string };
  readonly base: {
    readonly ref: string;
    readonly sha: string;
    readonly repo: {
      readonly name: string;
      readonly html_url: string;
      readonly default_branch: string;
      readonly private: boolean;
      readonly owner: { readonly login: string };
    };
  };
  readonly head: {
    readonly ref: string;
    readonly sha: string;
  };
}

interface GitHubPullRequestFileResponse {
  readonly filename: string;
  readonly previous_filename?: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
  readonly patch?: string;
  readonly raw_url?: string;
}

interface PreparedChangedFile {
  readonly publicFile: PullRequestChangedFile;
  readonly rawUrl: string | null;
}

const fileStatuses = new Set<PullRequestFileStatus>([
  "added",
  "modified",
  "removed",
  "renamed",
  "copied",
  "changed",
  "unchanged",
]);

export class PullRequestFetcher {
  private readonly fetchImplementation: typeof fetch;

  public constructor(private readonly options: PullRequestFetcherOptions) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  public async fetch(input: PullRequestInput): Promise<AcquiredPullRequest> {
    const reference = parsePullRequestReference(input);
    const pullRequest = await this.fetchJson<GitHubPullRequestResponse>(
      apiPath(reference),
    );
    if (pullRequest.base.repo.private) {
      throw new PullRequestReviewError(
        "pull-request-not-found",
        "Only pull requests from public GitHub repositories are supported.",
      );
    }
    if (pullRequest.changed_files > this.options.maxFiles) {
      throw new PullRequestReviewError(
        "pull-request-limit-exceeded",
        `Pull request changes ${pullRequest.changed_files} files, exceeding the configured limit of ${this.options.maxFiles}.`,
      );
    }

    const limitations: string[] = [
      "Pull Request Review analyzes only changed-file content at the pull request head commit.",
    ];
    const files = await this.fetchFiles(reference, pullRequest.changed_files);
    const directory = await mkdtemp(join(tmpdir(), "adam-pr-"));
    let totalSourceBytes = 0;
    let filesWithoutContent = 0;

    try {
      const changedFiles: PullRequestChangedFile[] = [];
      for (const file of files) {
        let contentAvailable = false;
        if (
          file.publicFile.status !== "removed" &&
          file.rawUrl !== null
        ) {
          const remainingBytes =
            this.options.maxTotalSourceBytes - totalSourceBytes;
          const content = await this.fetchRawContent(
            file.rawUrl,
            Math.min(this.options.maxFileBytes, remainingBytes),
          );
          if (content !== null) {
            await writeWorkspaceFile(
              directory,
              file.publicFile.filename,
              content,
            );
            totalSourceBytes += Buffer.byteLength(content, "utf8");
            contentAvailable = true;
          }
        }
        if (!contentAvailable) {
          filesWithoutContent += 1;
        }
        changedFiles.push({
          ...file.publicFile,
          contentAvailable,
        });
      }

      if (filesWithoutContent > 0) {
        limitations.push(
          `${filesWithoutContent} changed files were removed, binary, unavailable, or exceeded source inspection limits.`,
        );
      }
      const missingPatches = changedFiles.filter(
        (file) => file.patch === null,
      ).length;
      if (missingPatches > 0) {
        limitations.push(
          `${missingPatches} changed files did not include GitHub patch data.`,
        );
      }

      const metadata = buildMetadata(pullRequest);
      return {
        metadata,
        changedFiles,
        directory,
        identity: {
          name: metadata.repository,
          owner: metadata.owner,
          url: pullRequest.base.repo.html_url,
          defaultBranch: pullRequest.base.repo.default_branch,
          commitSha: metadata.headSha,
        },
        limitations,
        async cleanup() {
          await rm(directory, { recursive: true, force: true });
        },
      };
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  private async fetchFiles(
    reference: PullRequestReference,
    expectedCount: number,
  ): Promise<readonly PreparedChangedFile[]> {
    const files: PreparedChangedFile[] = [];
    let patchBytes = 0;

    for (let page = 1; files.length < expectedCount; page += 1) {
      const pageFiles = await this.fetchJson<
        readonly GitHubPullRequestFileResponse[]
      >(`${apiPath(reference)}/files?per_page=100&page=${page}`);
      for (const file of pageFiles) {
        const rawPatch = file.patch ?? null;
        const patchSize =
          rawPatch === null ? 0 : Buffer.byteLength(rawPatch, "utf8");
        const patch =
          rawPatch !== null &&
          patchBytes + patchSize <= this.options.maxPatchBytes
            ? rawPatch
            : null;
        patchBytes += patchSize;
        files.push({
          publicFile: {
            filename: file.filename,
            previousFilename: file.previous_filename ?? null,
            status: normalizeFileStatus(file.status),
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch,
            contentAvailable: false,
          },
          rawUrl: validateRawUrl(file.raw_url),
        });
      }

      if (pageFiles.length < 100) {
        break;
      }
      if (files.length > this.options.maxFiles) {
        throw new PullRequestReviewError(
          "pull-request-limit-exceeded",
          `Pull request exceeds the configured limit of ${this.options.maxFiles} changed files.`,
        );
      }
    }

    return files.slice(0, expectedCount);
  }

  private async fetchJson<Value>(path: string): Promise<Value> {
    const response = await this.request(
      `https://api.github.com${path}`,
      true,
    );
    return (await response.json()) as Value;
  }

  private async fetchRawContent(
    rawUrl: string,
    maximumBytes: number,
  ): Promise<string | null> {
    if (maximumBytes < 1) {
      return null;
    }

    let response: Response;
    try {
      response = await this.request(rawUrl, false);
    } catch (error) {
      if (error instanceof PullRequestReviewError) {
        return null;
      }
      throw error;
    }
    if (new URL(response.url).hostname !== "raw.githubusercontent.com") {
      return null;
    }
    const declaredLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > maximumBytes
    ) {
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maximumBytes || buffer.includes(0)) {
      return null;
    }
    return buffer.toString("utf8");
  }

  private async request(
    url: string,
    githubApiRequest: boolean,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    const headers: Record<string, string> = {
      accept: githubApiRequest
        ? "application/vnd.github+json"
        : "text/plain",
      "user-agent": "Adam-Pull-Request-Review",
    };
    if (githubApiRequest) {
      headers["x-github-api-version"] = "2022-11-28";
      if (this.options.token) {
        headers.authorization = `Bearer ${this.options.token}`;
      }
    }

    try {
      const response = await this.fetchImplementation(url, {
        headers,
        redirect: "follow",
        signal: controller.signal,
      });
      if (response.ok) {
        return response;
      }
      if (response.status === 404) {
        throw new PullRequestReviewError(
          "pull-request-not-found",
          "GitHub pull request was not found or is not public.",
        );
      }
      if (
        response.status === 429 ||
        (response.status === 403 &&
          response.headers.get("x-ratelimit-remaining") === "0")
      ) {
        throw new PullRequestReviewError(
          "github-rate-limited",
          "GitHub API rate limit was exceeded. Retry after the rate limit resets.",
        );
      }
      throw new PullRequestReviewError(
        "github-unavailable",
        `GitHub request failed with status ${response.status}.`,
      );
    } catch (error) {
      if (error instanceof PullRequestReviewError) {
        throw error;
      }
      throw new PullRequestReviewError(
        "github-unavailable",
        error instanceof Error && error.name === "AbortError"
          ? "GitHub request timed out."
          : "GitHub request failed.",
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function apiPath(reference: PullRequestReference): string {
  return `/repos/${encodeURIComponent(reference.owner)}/${encodeURIComponent(reference.repository)}/pulls/${reference.pullNumber}`;
}

function buildMetadata(
  pullRequest: GitHubPullRequestResponse,
): PullRequestMetadata {
  return {
    owner: pullRequest.base.repo.owner.login,
    repository: pullRequest.base.repo.name,
    number: pullRequest.number,
    url: pullRequest.html_url,
    title: pullRequest.title,
    description: pullRequest.body,
    author: pullRequest.user.login,
    state: pullRequest.state,
    draft: pullRequest.draft,
    baseBranch: pullRequest.base.ref,
    headBranch: pullRequest.head.ref,
    baseSha: pullRequest.base.sha,
    headSha: pullRequest.head.sha,
    commitCount: pullRequest.commits,
    changedFileCount: pullRequest.changed_files,
    additions: pullRequest.additions,
    deletions: pullRequest.deletions,
  };
}

function normalizeFileStatus(status: string): PullRequestFileStatus {
  return fileStatuses.has(status as PullRequestFileStatus)
    ? (status as PullRequestFileStatus)
    : "modified";
}

function validateRawUrl(rawUrl: string | undefined): string | null {
  if (!rawUrl) {
    return null;
  }
  try {
    const url = new URL(rawUrl);
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      return null;
    }
    if (url.hostname === "raw.githubusercontent.com") {
      return url.toString();
    }
    const pathSegments = url.pathname.split("/").filter(Boolean);
    return url.hostname === "github.com" &&
      pathSegments.length >= 5 &&
      pathSegments[2] === "raw"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function writeWorkspaceFile(
  rootDirectory: string,
  filename: string,
  content: string,
): Promise<void> {
  const normalized = filename.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new PullRequestReviewError(
      "github-unavailable",
      "GitHub returned an unsafe changed-file path.",
    );
  }

  const absolutePath = resolve(rootDirectory, ...segments);
  const rootPrefix = `${resolve(rootDirectory)}${sep}`;
  if (!absolutePath.startsWith(rootPrefix)) {
    throw new PullRequestReviewError(
      "github-unavailable",
      "GitHub returned a changed-file path outside the review workspace.",
    );
  }

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}
