import type { PlannerUnifiedResponse } from "@adam/contracts";

import type { ExecutionPlanner } from "./execution-planner.js";
import type { ResponseAggregator } from "./response-aggregator.js";
import type { ServiceOrchestrator } from "./service-orchestrator.js";
import { SharedExecutionContext } from "./shared-execution-context.js";
import type { IntentClassifier, PlannerInput } from "./types.js";

export class PlannerEngine {
  public constructor(
    private readonly classifier: IntentClassifier,
    private readonly executionPlanner: ExecutionPlanner,
    private readonly orchestrator: ServiceOrchestrator,
    private readonly aggregator: ResponseAggregator,
  ) {}

  public async execute(input: PlannerInput): Promise<PlannerUnifiedResponse> {
    const classification = this.classifier.classify(input.request);
    const plan = this.executionPlanner.createPlan(
      classification,
      input.logs.length > 0,
    );
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
}
