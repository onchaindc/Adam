import type {
  PullRequestChangedFile,
  PullRequestMetadata,
} from "@adam/contracts";

import type { RepositoryIdentity } from "../repository/model.js";

export interface PullRequestReference {
  readonly owner: string;
  readonly repository: string;
  readonly pullNumber: number;
}

export interface PullRequestInput {
  readonly pullRequest?: string;
  readonly owner?: string;
  readonly repo?: string;
  readonly pullNumber?: number;
}

export interface AcquiredPullRequest {
  readonly metadata: PullRequestMetadata;
  readonly changedFiles: readonly PullRequestChangedFile[];
  readonly directory: string;
  readonly identity: RepositoryIdentity;
  readonly limitations: readonly string[];
  cleanup(): Promise<void>;
}
