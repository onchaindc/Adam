import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface RuntimeState {
  readonly instanceId: string;
  readonly bootCount: number;
  readonly firstStartedAt: string;
  readonly lastStartedAt: string;
}

export interface RuntimeStateStore {
  initialize(): Promise<RuntimeState>;
  read(): Promise<RuntimeState | null>;
}

export class FileRuntimeStateStore implements RuntimeStateStore {
  public constructor(private readonly filePath: string) {}

  public async initialize(): Promise<RuntimeState> {
    const existing = await this.read();
    const now = new Date().toISOString();
    const nextState: RuntimeState = existing
      ? {
          ...existing,
          bootCount: existing.bootCount + 1,
          lastStartedAt: now,
        }
      : {
          instanceId: randomUUID(),
          bootCount: 1,
          firstStartedAt: now,
          lastStartedAt: now,
        };

    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(nextState, null, 2), "utf8");
    await rename(temporaryPath, this.filePath);

    return nextState;
  }

  public async read(): Promise<RuntimeState | null> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      return JSON.parse(contents) as RuntimeState;
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }
      throw error;
    }
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
