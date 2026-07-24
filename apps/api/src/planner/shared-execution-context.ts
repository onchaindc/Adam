import type {
  PlannerDecisionRecord,
  PlannerTimelineEntry,
  RepositoryIntelligenceResponse,
  RootCauseInvestigationResponse,
  SecurityAuditResponse,
  ServiceKind,
} from "@adam/contracts";

import type { RepositoryModel } from "../investigation/repository/model.js";
import type { PlannerLogInput } from "./types.js";

type ContextServiceResponse =
  | RepositoryIntelligenceResponse
  | SecurityAuditResponse
  | RootCauseInvestigationResponse;

export class SharedExecutionContext {
  private readonly results = new Map<ServiceKind, ContextServiceResponse>();
  private readonly timelineEntries: PlannerTimelineEntry[] = [];
  private readonly decisionEntries: PlannerDecisionRecord[] = [];

  public readonly startedAt = new Date();
  public readonly startedAtMs = Date.now();

  public constructor(
    public readonly requestId: string,
    public readonly request: string,
    public readonly repositoryUrl: string,
    public readonly logs: readonly PlannerLogInput[],
    public readonly model: RepositoryModel,
  ) {}

  public recordResult(result: ContextServiceResponse): void {
    if (this.results.has(result.service)) {
      throw new Error(`Service result already recorded: ${result.service}.`);
    }
    this.results.set(result.service, result);
  }

  public getResult(service: ServiceKind): ContextServiceResponse | undefined {
    return this.results.get(service);
  }

  public hasResult(service: ServiceKind): boolean {
    return this.results.has(service);
  }

  public recordTimeline(entry: PlannerTimelineEntry): void {
    this.timelineEntries.push(entry);
  }

  public get timeline(): readonly PlannerTimelineEntry[] {
    return this.timelineEntries;
  }

  public recordDecision(decision: PlannerDecisionRecord): void {
    this.decisionEntries.push(decision);
  }

  public get decisions(): readonly PlannerDecisionRecord[] {
    return this.decisionEntries;
  }
}
