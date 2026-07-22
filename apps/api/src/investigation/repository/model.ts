import type { RepositorySummary } from "@adam/contracts";

export interface RepositoryFile {
  readonly path: string;
  readonly extension: string;
  readonly sizeBytes: number;
}

export interface RepositoryIdentity {
  readonly name: string;
  readonly owner: string;
  readonly url: string;
  readonly defaultBranch: string;
  readonly commitSha: string;
}

export interface RepositoryModel {
  readonly identity: RepositoryIdentity;
  readonly rootDirectory: string;
  readonly files: readonly RepositoryFile[];
  readonly directories: readonly string[];
  readonly topLevelEntries: readonly string[];
  readonly manifestContents: Readonly<Record<string, string>>;
  readonly summary: RepositorySummary;
}
