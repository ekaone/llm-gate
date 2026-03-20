import type { GateStatus, TripReason } from "../types/index.js"

export class BudgetExceededError extends Error {
  readonly reason: TripReason
  readonly resets: Date
  readonly snapshot: GateStatus

  constructor(status: GateStatus) {
    super(
      `LLM gate tripped: ${status.reason ?? "limit_exceeded"}. ` +
      `Resets at ${status.resets.toISOString()}.`
    )
    this.name = "BudgetExceededError"
    this.reason = status.reason as TripReason
    this.resets = status.resets
    this.snapshot = status

    // Maintain proper prototype chain in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
