import type {
  RepositoryIntelligenceResponse,
  ServiceRequest,
} from "@adam/contracts";

import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { SharedExecutionContext } from "../planner/shared-execution-context.js";
import type { GitHubRepositoryAcquirer } from "../platform/github/github-repository.js";
import type { AdamService } from "./adam-service.js";
import { withRepositoryModel } from "./repository-model-execution.js";

interface RepositoryIntelligenceInput {
  readonly repositoryUrl: string;
}

export class RepositoryIntelligenceService implements AdamService {
  public readonly service = "repository-intelligence" as const;

  public constructor(
    private readonly acquirer: GitHubRepositoryAcquirer,
    private readonly scanner: RepositoryScanner,
  ) {}

  public async execute(
    request: ServiceRequest,
  ): Promise<RepositoryIntelligenceResponse> {
    const input = request.input as RepositoryIntelligenceInput;
    return withRepositoryModel(
      this.acquirer,
      this.scanner,
      input.repositoryUrl,
      (model) => this.buildResponse(request.requestId, model.summary),
    );
  }

  public async executeInContext(
    context: SharedExecutionContext,
  ): Promise<void> {
    context.recordResult(
      this.buildResponse(context.requestId, context.model.summary),
    );
  }

  private buildResponse(
    requestId: string,
    summary: RepositoryIntelligenceResponse["summary"],
  ): RepositoryIntelligenceResponse {
    return {
      service: this.service,
      status: "completed",
      requestId,
      summary,
    };
  }
}
