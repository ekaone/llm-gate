import type { UsageRecord } from "../types/index.js";

// Anthropic
export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AnthropicResponse {
  model: string;
  usage: AnthropicUsage;
}

export function fromAnthropic(response: AnthropicResponse): UsageRecord {
  return {
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// OpenAI
export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
}

export interface OpenAIResponse {
  model: string;
  usage: OpenAIUsage;
}

export function fromOpenAI(response: OpenAIResponse): UsageRecord {
  return {
    model: response.model,
    inputTokens: response.usage.prompt_tokens,
    outputTokens: response.usage.completion_tokens,
  };
}

// Auto-detect
type AnyLLMResponse = AnthropicResponse | OpenAIResponse;

function isAnthropic(r: AnyLLMResponse): r is AnthropicResponse {
  return "input_tokens" in (r as AnthropicResponse).usage;
}

/**
 * Auto-detect provider from response shape and normalize to UsageRecord.
 * Supports Anthropic and OpenAI response formats.
 */
export function fromResponse(response: AnyLLMResponse): UsageRecord {
  if (isAnthropic(response)) return fromAnthropic(response);
  return fromOpenAI(response as OpenAIResponse);
}
