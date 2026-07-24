export class PlannerInputError extends Error {
  public readonly code = "invalid-plan-input";

  public constructor(message: string) {
    super(message);
    this.name = "PlannerInputError";
  }
}
