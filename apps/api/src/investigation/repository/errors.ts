export type RepositoryErrorCode =
  | "invalid-repository-url"
  | "repository-unavailable"
  | "repository-limit-exceeded";

export class RepositoryIntelligenceError extends Error {
  public constructor(
    public readonly code: RepositoryErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RepositoryIntelligenceError";
  }
}
