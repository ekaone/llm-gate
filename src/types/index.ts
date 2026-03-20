// Circuit States
export type CircuitState = "OPEN" | "THROTTLED" | "TRIPPED";

export type TripReason =
  | "token_limit_exceeded"
  | "budget_limit_exceeded"
  | "request_limit_exceeded"
  | null;

export type ThrottleReason =
  | "approaching_token_limit"
  | "approaching_budget_limit"
  | "approaching_request_limit"
  | null;

// Gate Status
export interface GateMetric {
  used: number;
  remaining: number;
  limit: number;
}

export interface GateStatus {
  state: CircuitState;
  allowed: boolean;
  reason: TripReason | ThrottleReason;
  tokens: GateMetric;
  budget: GateMetric;
  requests: GateMetric;
  resets: Date;
}

// Usage Input
export interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// Pricing

export interface ModelPricing {
  inputPerToken: number; // cost per input token in USD
  outputPerToken: number; // cost per output token in USD
}

export type PricingTable = Record<string, ModelPricing>;

// Gate Options
export interface GateOptions {
  // limits — at least one required
  maxTokens?: number;
  maxBudget?: number; // USD
  maxRequests?: number;

  // window
  windowMs?: number; // default: 60_000 (1 minute)

  // throttle threshold — 0.0 to 1.0, default 0.8
  throttleAt?: number;

  // custom pricing table
  pricing?: PricingTable;

  // optional hooks — fire-and-forget, not awaited
  onThrottled?: (status: GateStatus) => void;
  onTripped?: (status: GateStatus) => void;
  onReset?: (status: GateStatus) => void;
}

// Gate Instance
export interface GateInstance {
  /** Record token usage from an LLM response */
  record: (usage: UsageRecord) => void;

  /** Check current gate status — never throws */
  check: () => GateStatus;

  /** Check and throw BudgetExceededError if TRIPPED */
  guard: () => void;

  /** Read-only snapshot of current state */
  snapshot: () => GateStatus;

  /** Manually reset gate to OPEN state */
  reset: () => void;
}
