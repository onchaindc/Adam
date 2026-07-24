import type {
  PlannerExecutionPlan,
  PlannerIntent,
  PlannerIntentClassification,
  ServiceKind,
} from "@adam/contracts";

import { PlannerInputError } from "./errors.js";
import type { IntentTarget, ServiceCapability } from "./types.js";

const defaultCapabilities: readonly ServiceCapability[] = [
  {
    service: "repository-intelligence",
    prerequisites: [],
    reason: "Build the shared Repository Model and repository overview.",
  },
  {
    service: "security-audit",
    prerequisites: ["repository-intelligence"],
    reason: "Run the approved Security Audit service against the shared Repository Model.",
  },
  {
    service: "root-cause-investigation",
    prerequisites: ["repository-intelligence"],
    reason: "Correlate supplied logs with the shared Repository Model.",
  },
  {
    service: "pull-request-review",
    prerequisites: [],
    reason:
      "Fetch the public GitHub Pull Request and review only its changed files.",
  },
];

const defaultTargets: readonly IntentTarget[] = [
  {
    intent: "repository-analysis",
    services: ["repository-intelligence"],
  },
  {
    intent: "security-audit",
    services: ["security-audit"],
  },
  {
    intent: "root-cause-investigation",
    services: ["root-cause-investigation"],
  },
  {
    intent: "combined-analysis",
    services: ["security-audit", "root-cause-investigation"],
  },
  {
    intent: "pull-request-review",
    services: ["pull-request-review"],
  },
];

export class ExecutionPlanner {
  private readonly capabilities: ReadonlyMap<ServiceKind, ServiceCapability>;
  private readonly targets: ReadonlyMap<PlannerIntent, readonly ServiceKind[]>;

  public constructor(
    capabilities: readonly ServiceCapability[] = defaultCapabilities,
    targets: readonly IntentTarget[] = defaultTargets,
  ) {
    this.capabilities = new Map(
      capabilities.map((capability) => [capability.service, capability]),
    );
    this.targets = new Map(
      targets.map((target) => [target.intent, target.services]),
    );
  }

  public createPlan(
    classification: PlannerIntentClassification,
    hasLogs: boolean,
  ): PlannerExecutionPlan {
    const configuredTargets = this.targets.get(classification.intent);
    if (!configuredTargets) {
      throw new Error(`No execution target for ${classification.intent}.`);
    }
    if (
      classification.intent === "root-cause-investigation" &&
      !hasLogs
    ) {
      throw new PlannerInputError(
        "Root Cause Investigation requests require at least one build, runtime, CI, stack-trace, or error log.",
      );
    }

    const omittedServices =
      classification.intent === "combined-analysis" && !hasLogs
        ? [
            {
              service: "root-cause-investigation" as const,
              reason:
                "Root Cause Investigation was omitted because no failure logs were supplied.",
            },
          ]
        : [];
    const targets = configuredTargets.filter(
      (service) =>
        !omittedServices.some((omitted) => omitted.service === service),
    );
    const orderedServices = this.resolveDependencies(targets);

    return {
      intent: classification.intent,
      steps: orderedServices.map((service, index) => {
        const capability = this.requireCapability(service);
        return {
          order: index + 1,
          service,
          prerequisites: capability.prerequisites,
          reason: capability.reason,
        };
      }),
      omittedServices,
    };
  }

  private resolveDependencies(
    targets: readonly ServiceKind[],
  ): readonly ServiceKind[] {
    const ordered: ServiceKind[] = [];
    const visiting = new Set<ServiceKind>();
    const visited = new Set<ServiceKind>();

    const visit = (service: ServiceKind) => {
      if (visited.has(service)) {
        return;
      }
      if (visiting.has(service)) {
        throw new Error(`Cyclic service dependency detected at ${service}.`);
      }

      visiting.add(service);
      const capability = this.requireCapability(service);
      for (const prerequisite of capability.prerequisites) {
        visit(prerequisite);
      }
      visiting.delete(service);
      visited.add(service);
      ordered.push(service);
    };

    for (const target of targets) {
      visit(target);
    }

    return ordered;
  }

  private requireCapability(service: ServiceKind): ServiceCapability {
    const capability = this.capabilities.get(service);
    if (!capability) {
      throw new Error(`No capability registered for ${service}.`);
    }
    return capability;
  }
}
