import type {
  PlannerUnifiedResponse,
  ServiceRequest,
} from "@adam/contracts";

import type { RepositoryScanner } from "../investigation/repository/repository-scanner.js";
import type { PlannerEngine } from "../planner/planner-engine.js";
import type { PlannerLogInput } from "../planner/types.js";
import type { GitHubRepositoryAcquirer } from "../platform/github/github-repository.js";
import type { AdamService } from "./adam-service.js";
import { withRepositoryModel } from "./repository-model-execution.js";

interface PlannerServiceInput {
  readonly request: string;
  readonly repositoryUrl: string;
  readonly logs: readonly PlannerLogInput[];
}

export class PlannerService implements AdamService {
  public constructor(
    private readonly acquirer: GitHubRepositoryAcquirer,
    private readonly scanner: RepositoryScanner,
    private readonly engine: PlannerEngine,
  ) {}

  public async execute(
    request: ServiceRequest,
  ): Promise<PlannerUnifiedResponse> {
    const input = request.input as PlannerServiceInput;

    return withRepositoryModel(
      this.acquirer,
      this.scanner,
      input.repositoryUrl,
      (model) =>
        this.engine.execute({
          requestId: request.requestId,
          request: input.request,
          repositoryUrl: input.repositoryUrl,
          logs: input.logs,
          model,
        }),
    );
  }
}
