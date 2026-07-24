import type {
  RootCauseInvestigationResponse,
  ServiceRequest,
} from "@adam/contracts";

import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { RootCauseEngine } from "../investigation/root-cause/root-cause-engine.js";
import type { InvestigationLogInput } from "../investigation/root-cause/types.js";
import type { GitHubRepositoryAcquirer } from "../platform/github/github-repository.js";
import { buildInvestigationResponse } from "../reporting/root-cause/investigation-report-builder.js";
import type { AdamService } from "./placeholder-services.js";

interface RootCauseInvestigationInput {
  readonly repositoryUrl: string;
  readonly logs: readonly InvestigationLogInput[];
}

export class RootCauseInvestigationService implements AdamService {
  public constructor(
    private readonly acquirer: GitHubRepositoryAcquirer,
    private readonly scanner: RepositoryScanner,
    private readonly engine: RootCauseEngine,
  ) {}

  public async execute(
    request: ServiceRequest,
  ): Promise<RootCauseInvestigationResponse> {
    const input = request.input as RootCauseInvestigationInput;
    const acquired = await this.acquirer.acquire(input.repositoryUrl);

    try {
      const model = await this.scanner.scan(acquired.directory, {
        name: acquired.reference.name,
        owner: acquired.reference.owner,
        url: acquired.reference.canonicalUrl.replace(/\.git$/, ""),
        defaultBranch: acquired.defaultBranch,
        commitSha: acquired.commitSha,
      });
      const result = this.engine.investigate(model, input.logs);

      return buildInvestigationResponse({
        requestId: request.requestId,
        model,
        candidate: result.candidate,
        entries: result.entries,
        limitations: result.limitations,
      });
    } finally {
      await acquired.cleanup();
    }
  }
}
