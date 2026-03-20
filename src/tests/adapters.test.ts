import { describe, it, expect } from "vitest"
import { fromAnthropic, fromOpenAI, fromResponse } from "../adapters/index.js"

describe("fromAnthropic()", () => {
  it("maps Anthropic response to UsageRecord", () => {
    const result = fromAnthropic({
      model: "claude-sonnet-4-20250514",
      usage: { input_tokens: 312, output_tokens: 89 },
    })
    expect(result).toEqual({
      model: "claude-sonnet-4-20250514",
      inputTokens: 312,
      outputTokens: 89,
    })
  })
})

describe("fromOpenAI()", () => {
  it("maps OpenAI response to UsageRecord", () => {
    const result = fromOpenAI({
      model: "gpt-4o",
      usage: { prompt_tokens: 200, completion_tokens: 100 },
    })
    expect(result).toEqual({
      model: "gpt-4o",
      inputTokens: 200,
      outputTokens: 100,
    })
  })
})

describe("fromResponse() — auto-detect", () => {
  it("detects Anthropic response shape", () => {
    const result = fromResponse({
      model: "claude-haiku-4-5-20251001",
      usage: { input_tokens: 50, output_tokens: 25 },
    })
    expect(result.inputTokens).toBe(50)
    expect(result.outputTokens).toBe(25)
  })

  it("detects OpenAI response shape", () => {
    const result = fromResponse({
      model: "gpt-4o-mini",
      usage: { prompt_tokens: 150, completion_tokens: 75 },
    })
    expect(result.inputTokens).toBe(150)
    expect(result.outputTokens).toBe(75)
  })
})
