import type {
  RepositoryIntelligenceResponse,
  ServiceRequest,
} from "@adam/contracts";

import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { GitHubRepositoryAcquirer } from "../platform/github/github-repository.js";
import type { AdamService } from "./placeholder-services.js";

interface RepositoryIntelligenceInput {
  readonly repositoryUrl: string;
}

export class RepositoryIntelligenceService implements AdamService {
  public constructor(
    private readonly acquirer: GitHubRepositoryAcquirer,
    private readonly scanner: RepositoryScanner,
  ) {}

  public async execute(
    request: ServiceRequest,
  ): Promise<RepositoryIntelligenceResponse> {
    const input = request.input as RepositoryIntelligenceInput;
    const acquired = await this.acquirer.acquire(input.repositoryUrl);

    try {
      const model = await this.scanner.scan(acquired.directory, {
        name: acquired.reference.name,
        owner: acquired.reference.owner,
        url: acquired.reference.canonicalUrl.replace(/\.git$/, ""),
        defaultBranch: acquired.defaultBranch,
        commitSha: acquired.commitSha,
      });

      return {
        service: "repository-intelligence",
        status: "completed",
        requestId: request.requestId,
        summary: model.summary,
      };
    } finally {
      await acquired.cleanup();
    }
  }
}
