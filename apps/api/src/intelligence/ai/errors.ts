export type AiIntelligenceErrorCode =
  | "ai-not-configured"
  | "ai-provider-failure"
  | "ai-output-invalid";

export class AiIntelligenceError extends Error {
  public constructor(
    public readonly code: AiIntelligenceErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AiIntelligenceError";
  }
}
