export type PullRequestReviewErrorCode =
  | "invalid-pull-request-reference"
  | "pull-request-not-found"
  | "pull-request-limit-exceeded"
  | "github-rate-limited"
  | "github-unavailable";

export class PullRequestReviewError extends Error {
  public constructor(
    public readonly code: PullRequestReviewErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PullRequestReviewError";
  }
}
