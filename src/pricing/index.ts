import type { PricingTable } from "../types/index.js";

/**
 * Default pricing table for common models.
 * Prices are per token in USD.
 * Users can override via GateOptions.pricing.
 *
 * Last updated: 2026-03
 */
export const defaultPricing: PricingTable = {
  // Anthropic
  "claude-opus-4-20250514": {
    inputPerToken: 0.000015,
    outputPerToken: 0.000075,
  },
  "claude-sonnet-4-20250514": {
    inputPerToken: 0.000003,
    outputPerToken: 0.000015,
  },
  "claude-haiku-4-5-20251001": {
    inputPerToken: 0.0000008,
    outputPerToken: 0.000004,
  },

  // OpenAI
  "gpt-4o": {
    inputPerToken: 0.0000025,
    outputPerToken: 0.00001,
  },
  "gpt-4o-mini": {
    inputPerToken: 0.00000015,
    outputPerToken: 0.0000006,
  },
  "gpt-4-turbo": {
    inputPerToken: 0.00001,
    outputPerToken: 0.00003,
  },
  o3: {
    inputPerToken: 0.00001,
    outputPerToken: 0.00004,
  },
  "o4-mini": {
    inputPerToken: 0.0000011,
    outputPerToken: 0.0000044,
  },
};

/**
 * Resolve cost for a given model and token counts.
 * Falls back to 0 if model is not found in the table.
 */
export function resolveCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  pricing: PricingTable,
): number {
  const entry = pricing[model];
  if (!entry) return 0;
  return (
    inputTokens * entry.inputPerToken + outputTokens * entry.outputPerToken
  );
}
