import type {
  RootCauseInvestigationResponse,
  ServiceRequest,
} from "@adam/contracts";

import type { RepositoryModel } from "../investigation/repository/model.js";
import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { RootCauseEngine } from "../investigation/root-cause/root-cause-engine.js";
import type { InvestigationLogInput } from "../investigation/root-cause/types.js";
import type { SharedExecutionContext } from "../planner/shared-execution-context.js";
import type { GitHubRepositoryAcquirer } from "../platform/github/github-repository.js";
import { buildInvestigationResponse } from "../reporting/root-cause/investigation-report-builder.js";
import type { AdamService } from "./adam-service.js";
import { withRepositoryModel } from "./repository-model-execution.js";

interface RootCauseInvestigationInput {
  readonly repositoryUrl: string;
  readonly logs: readonly InvestigationLogInput[];
}

export class RootCauseInvestigationService implements AdamService {
  public readonly service = "root-cause-investigation" as const;

  public constructor(
    private readonly acquirer: GitHubRepositoryAcquirer,
    private readonly scanner: RepositoryScanner,
    private readonly engine: RootCauseEngine,
  ) {}

  public async execute(
    request: ServiceRequest,
  ): Promise<RootCauseInvestigationResponse> {
    const input = request.input as RootCauseInvestigationInput;
    return withRepositoryModel(
      this.acquirer,
      this.scanner,
      input.repositoryUrl,
      (model) =>
        this.investigateModel(request.requestId, model, input.logs),
    );
  }

  public async executeInContext(
    context: SharedExecutionContext,
  ): Promise<void> {
    context.recordResult(
      this.investigateModel(
        context.requestId,
        context.model,
        context.logs,
      ),
    );
  }

  private investigateModel(
    requestId: string,
    model: RepositoryModel,
    logs: readonly InvestigationLogInput[],
  ): RootCauseInvestigationResponse {
    const result = this.engine.investigate(model, logs);

    return buildInvestigationResponse({
      requestId,
      model,
      candidate: result.candidate,
      entries: result.entries,
      limitations: result.limitations,
    });
  }
}
