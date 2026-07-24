import { PullRequestReviewError } from "./errors.js";
import type {
  PullRequestInput,
  PullRequestReference,
} from "./types.js";

const ownerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const repositoryPattern = /^[A-Za-z0-9._-]+$/;

export function parsePullRequestReference(
  input: PullRequestInput,
): PullRequestReference {
  if (input.pullRequest !== undefined) {
    if (
      input.owner !== undefined ||
      input.repo !== undefined ||
      input.pullNumber !== undefined
    ) {
      throw invalidReference(
        "Use either pullRequest URL or owner/repo/pullNumber coordinates, not both.",
      );
    }
    return parsePullRequestUrl(input.pullRequest);
  }

  if (
    input.owner === undefined ||
    input.repo === undefined ||
    input.pullNumber === undefined
  ) {
    throw invalidReference(
      "Provide a GitHub pull request URL or complete owner, repo, and pullNumber coordinates.",
    );
  }

  return validateReference({
    owner: input.owner,
    repository: input.repo,
    pullNumber: input.pullNumber,
  });
}

export function parsePullRequestUrl(urlValue: string): PullRequestReference {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch (error) {
    throw invalidReference("Pull request URL is invalid.", error);
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "github.com" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw invalidReference(
      "Pull request URL must be a credential-free HTTPS github.com URL.",
    );
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (
    segments.length !== 4 ||
    segments[2]?.toLowerCase() !== "pull"
  ) {
    throw invalidReference(
      "Pull request URL must match https://github.com/owner/repo/pull/number.",
    );
  }

  return validateReference({
    owner: segments[0] ?? "",
    repository: segments[1] ?? "",
    pullNumber: Number(segments[3]),
  });
}

function validateReference(
  reference: PullRequestReference,
): PullRequestReference {
  if (
    !ownerPattern.test(reference.owner) ||
    !repositoryPattern.test(reference.repository) ||
    !Number.isSafeInteger(reference.pullNumber) ||
    reference.pullNumber < 1
  ) {
    throw invalidReference("Pull request owner, repository, or number is invalid.");
  }

  return reference;
}

function invalidReference(
  message: string,
  cause?: unknown,
): PullRequestReviewError {
  return new PullRequestReviewError(
    "invalid-pull-request-reference",
    message,
    cause === undefined ? undefined : { cause },
  );
}
