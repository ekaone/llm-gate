// ─── Core ─
export { createGate } from "./gate.js";

// Errors
export { BudgetExceededError } from "./errors/index.js";

// Adapters (optional — tree-shakeable)
export { fromAnthropic, fromOpenAI, fromResponse } from "./adapters/index.js";
export type { AnthropicResponse, OpenAIResponse } from "./adapters/index.js";

// Pricing (optional — tree-shakeable)
export { defaultPricing, resolveCost } from "./pricing/index.js";

// Types
export type {
  CircuitState,
  GateInstance,
  GateMetric,
  GateOptions,
  GateStatus,
  ModelPricing,
  PricingTable,
  TripReason,
  ThrottleReason,
  UsageRecord,
} from "./types/index.js";
