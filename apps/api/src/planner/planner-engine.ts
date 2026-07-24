import type { ExecutionPlanner } from "./execution-planner.js";
import type { ResponseAggregator } from "./response-aggregator.js";
import type { ServiceOrchestrator } from "./service-orchestrator.js";
import { SharedExecutionContext } from "./shared-execution-context.js";
import type {
  IntentClassifier,
  PlannerInput,
  PlannerPreparation,
} from "./types.js";
import type { UntracedPlannerUnifiedResponse } from "../traceability/types.js";

export class PlannerEngine {
  public constructor(
    private readonly classifier: IntentClassifier,
    private readonly executionPlanner: ExecutionPlanner,
    private readonly orchestrator: ServiceOrchestrator,
    private readonly aggregator: ResponseAggregator,
  ) {}

  public async execute(
    input: PlannerInput,
    preparation: PlannerPreparation = this.prepare(
      input.request,
      input.logs.length > 0,
    ),
  ): Promise<UntracedPlannerUnifiedResponse> {
    const { classification, plan } = preparation;
    const context = new SharedExecutionContext(
      input.requestId,
      input.request,
      input.repositoryUrl,
      input.logs,
      input.model,
    );
    context.recordDecision({
      stage: "intent-classification",
      decision: classification.intent,
      rationale: classification.rationale,
    });
    context.recordDecision({
      stage: "execution-planning",
      decision: plan.steps.map((step) => step.service).join(" -> "),
      rationale:
        plan.omittedServices.length > 0
          ? plan.omittedServices.map((item) => item.reason).join(" ")
          : "All services required for the classified intent were scheduled in dependency order.",
    });

    await this.orchestrator.execute(plan, context);

    return this.aggregator.aggregate({
      context,
      classification,
      plan,
    });
  }

  public prepare(request: string, hasLogs: boolean): PlannerPreparation {
    const classification = this.classifier.classify(request);
    return {
      classification,
      plan: this.executionPlanner.createPlan(classification, hasLogs),
    };
  }

  public aggregatePullRequest(
    input: Parameters<ResponseAggregator["aggregatePullRequest"]>[0],
  ): UntracedPlannerUnifiedResponse {
    return this.aggregator.aggregatePullRequest(input);
  }
}
