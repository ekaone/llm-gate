import { BudgetExceededError } from "./errors/index.js"
import { defaultPricing, resolveCost } from "./pricing/index.js"
import type {
  CircuitState,
  GateInstance,
  GateMetric,
  GateOptions,
  GateStatus,
  ThrottleReason,
  TripReason,
  UsageRecord,
} from "./types/index.js"

const DEFAULT_WINDOW_MS  = 60_000  // 1 minute
const DEFAULT_THROTTLE   = 0.8     // 80% of limit triggers THROTTLED
const SENTINEL_LIMIT     = Infinity // when a dimension is not configured

function makeMetric(used: number, limit: number): GateMetric {
  return {
    used,
    remaining: limit === Infinity ? Infinity : Math.max(0, limit - used),
    limit: limit === Infinity ? -1 : limit,
  }
}

/**
 * createGate — lightweight LLM budget & token guard.
 *
 * @example
 * ```ts
 * const gate = createGate({
 *   maxTokens:   5000,
 *   maxBudget:   0.10,
 *   maxRequests: 100,
 *   windowMs:    60_000,
 *   onThrottled: (s) => console.warn("Throttled", s.tokens),
 *   onTripped:   (s) => console.error("Tripped!", s.reason),
 *   onReset:     (s) => console.log("Gate reset"),
 * })
 * ```
 */
export function createGate(options: GateOptions = {}): GateInstance {
  // ── Config ──────────────────────────────────────────────────────────────────
  const maxTokens   = options.maxTokens   ?? SENTINEL_LIMIT
  const maxBudget   = options.maxBudget   ?? SENTINEL_LIMIT
  const maxRequests = options.maxRequests ?? SENTINEL_LIMIT
  const windowMs    = options.windowMs    ?? DEFAULT_WINDOW_MS
  const throttleAt  = options.throttleAt  ?? DEFAULT_THROTTLE
  const pricing     = { ...defaultPricing, ...options.pricing }

  if (maxTokens === SENTINEL_LIMIT && maxBudget === SENTINEL_LIMIT && maxRequests === SENTINEL_LIMIT) {
    throw new Error(
      "[llm-gate] At least one limit must be set: maxTokens, maxBudget, or maxRequests."
    )
  }

  // ── Internal State ──────────────────────────────────────────────────────────
  let tokensUsed   = 0
  let budgetUsed   = 0
  let requestCount = 0
  let state: CircuitState = "OPEN"
  let windowStart  = Date.now()

  // ── Window Management ───────────────────────────────────────────────────────
  function checkWindowReset(): void {
    const now = Date.now()
    if (now - windowStart >= windowMs) {
      const prevState = state
      tokensUsed   = 0
      budgetUsed   = 0
      requestCount = 0
      state        = "OPEN"
      windowStart  = now

      if (prevState !== "OPEN") {
        options.onReset?.(buildStatus())
      }
    }
  }

  // ── Status Builder ──────────────────────────────────────────────────────────
  function buildStatus(): GateStatus {
    const resets = new Date(windowStart + windowMs)

    let reason: TripReason | ThrottleReason = null

    if (state === "TRIPPED") {
      if (tokensUsed >= maxTokens)     reason = "token_limit_exceeded"
      else if (budgetUsed >= maxBudget) reason = "budget_limit_exceeded"
      else                              reason = "request_limit_exceeded"
    } else if (state === "THROTTLED") {
      if (tokensUsed   >= maxTokens   * throttleAt) reason = "approaching_token_limit"
      else if (budgetUsed   >= maxBudget   * throttleAt) reason = "approaching_budget_limit"
      else                                               reason = "approaching_request_limit"
    }

    return {
      state,
      allowed: state !== "TRIPPED",
      reason,
      tokens:   makeMetric(tokensUsed,   maxTokens),
      budget:   makeMetric(budgetUsed,   maxBudget),
      requests: makeMetric(requestCount, maxRequests),
      resets,
    }
  }

  // ── State Machine ───────────────────────────────────────────────────────────
  function evaluateState(): void {
    const prevState = state

    // Check TRIPPED first — hard limits
    if (
      tokensUsed   >= maxTokens   ||
      budgetUsed   >= maxBudget   ||
      requestCount >= maxRequests
    ) {
      state = "TRIPPED"
      if (prevState !== "TRIPPED") {
        options.onTripped?.(buildStatus())
      }
      return
    }

    // Check THROTTLED — soft warning threshold
    if (
      tokensUsed   >= maxTokens   * throttleAt ||
      budgetUsed   >= maxBudget   * throttleAt ||
      requestCount >= maxRequests * throttleAt
    ) {
      state = "THROTTLED"
      if (prevState !== "THROTTLED") {
        options.onThrottled?.(buildStatus())
      }
      return
    }

    state = "OPEN"
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  function record(usage: UsageRecord): void {
    checkWindowReset()

    const cost = resolveCost(usage.model, usage.inputTokens, usage.outputTokens, pricing)

    tokensUsed   += usage.inputTokens + usage.outputTokens
    budgetUsed   += cost
    requestCount += 1

    evaluateState()
  }

  function check(): GateStatus {
    checkWindowReset()
    return buildStatus()
  }

  function guard(): void {
    checkWindowReset()
    const status = buildStatus()
    if (status.state === "TRIPPED") {
      throw new BudgetExceededError(status)
    }
  }

  function snapshot(): GateStatus {
    return buildStatus()
  }

  function reset(): void {
    tokensUsed   = 0
    budgetUsed   = 0
    requestCount = 0
    state        = "OPEN"
    windowStart  = Date.now()
    options.onReset?.(buildStatus())
  }

  return { record, check, guard, snapshot, reset }
}
