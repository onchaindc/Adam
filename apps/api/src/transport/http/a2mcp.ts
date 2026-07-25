import type { Response } from "express";

export interface A2mcpRequiredInput {
  readonly id: string;
  readonly type: "string" | "enum" | "array" | "object";
  readonly required: boolean;
  readonly prompt: string;
  readonly options?: readonly string[];
}

export interface A2mcpNeedsInputOptions {
  readonly service: string;
  readonly message: string;
  readonly requiredInputs: readonly A2mcpRequiredInput[];
}

export class A2mcpRequestTimeoutError extends Error {
  public constructor(public readonly timeoutMs: number) {
    super(`The A2MCP request exceeded the ${timeoutMs}ms execution deadline.`);
    this.name = "A2mcpRequestTimeoutError";
  }
}

export function isBareInvocation(body: unknown): boolean {
  return (
    body === undefined ||
    body === null ||
    (isRecord(body) && Object.keys(body).length === 0)
  );
}

export function sendNeedsInput(
  response: Response,
  requestId: string,
  options: A2mcpNeedsInputOptions,
): void {
  response.status(200).json({
    service: options.service,
    status: "needs_input",
    requestId,
    message: options.message,
    requiredInputs: options.requiredInputs,
  });
}

export async function executeWithDeadline<Value>(
  operation: () => Promise<Value>,
  timeoutMs: number,
): Promise<Value> {
  let timer: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new A2mcpRequestTimeoutError(timeoutMs)),
          timeoutMs,
        );
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
