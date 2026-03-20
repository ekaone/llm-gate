import { describe, it, expect } from "vitest"
import { resolveCost, defaultPricing } from "../pricing/index.js"

describe("resolveCost()", () => {
  it("calculates cost for claude-sonnet-4", () => {
    const cost = resolveCost("claude-sonnet-4-20250514", 1000, 500, defaultPricing)
    // 1000 * 0.000003 + 500 * 0.000015 = 0.003 + 0.0075 = 0.0105
    expect(cost).toBeCloseTo(0.0105)
  })

  it("calculates cost for gpt-4o", () => {
    const cost = resolveCost("gpt-4o", 1000, 500, defaultPricing)
    // 1000 * 0.0000025 + 500 * 0.00001 = 0.0025 + 0.005 = 0.0075
    expect(cost).toBeCloseTo(0.0075)
  })

  it("returns 0 for unknown model", () => {
    const cost = resolveCost("unknown-model", 1000, 500, defaultPricing)
    expect(cost).toBe(0)
  })

  it("uses custom pricing over defaults", () => {
    const customPricing = {
      "my-model": { inputPerToken: 0.01, outputPerToken: 0.02 }
    }
    const cost = resolveCost("my-model", 10, 5, customPricing)
    // 10 * 0.01 + 5 * 0.02 = 0.1 + 0.1 = 0.2
    expect(cost).toBeCloseTo(0.2)
  })

  it("handles zero tokens", () => {
    const cost = resolveCost("claude-sonnet-4-20250514", 0, 0, defaultPricing)
    expect(cost).toBe(0)
  })
})
