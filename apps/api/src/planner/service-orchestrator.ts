import type { PlannerExecutionPlan, ServiceKind } from "@adam/contracts";

import type { SharedExecutionContext } from "./shared-execution-context.js";

export interface ContextualPlannerService {
  readonly service: ServiceKind;
  executeInContext(context: SharedExecutionContext): Promise<void>;
}

export class ServiceOrchestrator {
  private readonly services: ReadonlyMap<ServiceKind, ContextualPlannerService>;

  public constructor(services: readonly ContextualPlannerService[]) {
    const registry = new Map<ServiceKind, ContextualPlannerService>();
    for (const service of services) {
      if (registry.has(service.service)) {
        throw new Error(`Duplicate planner service: ${service.service}.`);
      }
      registry.set(service.service, service);
    }
    this.services = registry;
  }

  public async execute(
    plan: PlannerExecutionPlan,
    context: SharedExecutionContext,
  ): Promise<void> {
    for (const step of plan.steps) {
      for (const prerequisite of step.prerequisites) {
        if (!context.hasResult(prerequisite)) {
          throw new Error(
            `${step.service} cannot execute before ${prerequisite}.`,
          );
        }
      }

      const service = this.services.get(step.service);
      if (!service) {
        throw new Error(`No planner service registered for ${step.service}.`);
      }

      const startedAt = new Date();
      const startedAtMs = Date.now();
      try {
        await service.executeInContext(context);
        if (!context.hasResult(step.service)) {
          throw new Error(
            `${step.service} completed without recording a context result.`,
          );
        }
        context.recordTimeline({
          service: step.service,
          status: "completed",
          startedAt: startedAt.toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: Math.max(0, Date.now() - startedAtMs),
        });
      } catch (error) {
        context.recordTimeline({
          service: step.service,
          status: "failed",
          startedAt: startedAt.toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: Math.max(0, Date.now() - startedAtMs),
        });
        throw error;
      }
    }
  }
}
