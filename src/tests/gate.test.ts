import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGate } from "../gate.js";
import { BudgetExceededError } from "../errors/index.js";

const anthropicUsage = (inputTokens: number, outputTokens: number) => ({
  model: "claude-sonnet-4-20250514",
  inputTokens,
  outputTokens,
});

// Constructor

describe("createGate — constructor", () => {
  it("throws if no limits are provided", () => {
    expect(() => createGate({})).toThrow("[llm-gate]");
  });

  it("creates gate with only maxTokens", () => {
    expect(() => createGate({ maxTokens: 5000 })).not.toThrow();
  });

  it("creates gate with only maxBudget", () => {
    expect(() => createGate({ maxBudget: 0.1 })).not.toThrow();
  });

  it("creates gate with only maxRequests", () => {
    expect(() => createGate({ maxRequests: 10 })).not.toThrow();
  });
});

// Initial State

describe("createGate — initial state", () => {
  it("starts in OPEN state", () => {
    const gate = createGate({ maxTokens: 5000 });
    expect(gate.check().state).toBe("OPEN");
  });

  it("starts with allowed: true", () => {
    const gate = createGate({ maxTokens: 5000 });
    expect(gate.check().allowed).toBe(true);
  });

  it("starts with reason: null", () => {
    const gate = createGate({ maxTokens: 5000 });
    expect(gate.check().reason).toBeNull();
  });

  it("starts with zero usage", () => {
    const gate = createGate({ maxTokens: 5000 });
    const status = gate.check();
    expect(status.tokens.used).toBe(0);
    expect(status.budget.used).toBe(0);
    expect(status.requests.used).toBe(0);
  });
});

// record()

describe("record()", () => {
  it("accumulates token usage", () => {
    const gate = createGate({ maxTokens: 5000 });
    gate.record(anthropicUsage(300, 100));
    gate.record(anthropicUsage(200, 50));
    expect(gate.check().tokens.used).toBe(650);
  });

  it("increments request count", () => {
    const gate = createGate({ maxRequests: 10 });
    gate.record(anthropicUsage(100, 50));
    gate.record(anthropicUsage(100, 50));
    expect(gate.check().requests.used).toBe(2);
  });

  it("accumulates budget from known model pricing", () => {
    const gate = createGate({ maxBudget: 1.0 });
    gate.record(anthropicUsage(1000, 500));
    const status = gate.check();
    expect(status.budget.used).toBeGreaterThan(0);
  });

  it("budget stays 0 for unknown model", () => {
    const gate = createGate({ maxBudget: 1.0 });
    gate.record({
      model: "unknown-model-xyz",
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(gate.check().budget.used).toBe(0);
  });
});

// State Transitions

describe("state transitions", () => {
  it("transitions to THROTTLED at 80% of maxTokens", () => {
    const gate = createGate({ maxTokens: 1000 });
    gate.record(anthropicUsage(800, 0)); // exactly 80%
    expect(gate.check().state).toBe("THROTTLED");
  });

  it("transitions to TRIPPED at 100% of maxTokens", () => {
    const gate = createGate({ maxTokens: 1000 });
    gate.record(anthropicUsage(1000, 0));
    expect(gate.check().state).toBe("TRIPPED");
  });

  it("transitions to TRIPPED when tokens exceed limit", () => {
    const gate = createGate({ maxTokens: 1000 });
    gate.record(anthropicUsage(600, 0));
    gate.record(anthropicUsage(600, 0)); // total 1200 > 1000
    expect(gate.check().state).toBe("TRIPPED");
  });

  it("transitions to TRIPPED at maxRequests", () => {
    const gate = createGate({ maxRequests: 3 });
    gate.record(anthropicUsage(10, 10));
    gate.record(anthropicUsage(10, 10));
    gate.record(anthropicUsage(10, 10));
    expect(gate.check().state).toBe("TRIPPED");
  });

  it("respects custom throttleAt threshold", () => {
    const gate = createGate({ maxTokens: 1000, throttleAt: 0.5 });
    gate.record(anthropicUsage(500, 0)); // exactly 50%
    expect(gate.check().state).toBe("THROTTLED");
  });
});

// check()

describe("check()", () => {
  it("returns correct remaining tokens", () => {
    const gate = createGate({ maxTokens: 1000 });
    gate.record(anthropicUsage(300, 100));
    const status = gate.check();
    expect(status.tokens.remaining).toBe(600);
  });

  it("returns correct reason when THROTTLED", () => {
    const gate = createGate({ maxTokens: 1000 });
    gate.record(anthropicUsage(850, 0));
    expect(gate.check().reason).toBe("approaching_token_limit");
  });

  it("returns correct reason when TRIPPED by tokens", () => {
    const gate = createGate({ maxTokens: 1000 });
    gate.record(anthropicUsage(1000, 0));
    expect(gate.check().reason).toBe("token_limit_exceeded");
  });

  it("returns correct reason when TRIPPED by requests", () => {
    const gate = createGate({ maxRequests: 1 });
    gate.record(anthropicUsage(10, 10));
    expect(gate.check().reason).toBe("request_limit_exceeded");
  });

  it("returns a resets Date in the future", () => {
    const gate = createGate({ maxTokens: 1000 });
    const status = gate.check();
    expect(status.resets.getTime()).toBeGreaterThan(Date.now());
  });
});

// guard()

describe("guard()", () => {
  it("does not throw when OPEN", () => {
    const gate = createGate({ maxTokens: 5000 });
    expect(() => gate.guard()).not.toThrow();
  });

  it("does not throw when THROTTLED", () => {
    const gate = createGate({ maxTokens: 1000 });
    gate.record(anthropicUsage(850, 0));
    expect(() => gate.guard()).not.toThrow();
  });

  it("throws BudgetExceededError when TRIPPED", () => {
    const gate = createGate({ maxTokens: 1000 });
    gate.record(anthropicUsage(1000, 0));
    expect(() => gate.guard()).toThrow(BudgetExceededError);
  });

  it("thrown error contains reason and resets", () => {
    const gate = createGate({ maxTokens: 1000 });
    gate.record(anthropicUsage(1000, 0));
    try {
      gate.guard();
    } catch (err) {
      expect(err).toBeInstanceOf(BudgetExceededError);
      const e = err as BudgetExceededError;
      expect(e.reason).toBe("token_limit_exceeded");
      expect(e.resets).toBeInstanceOf(Date);
      expect(e.snapshot).toBeDefined();
    }
  });
});

// reset()

describe("reset()", () => {
  it("resets state to OPEN", () => {
    const gate = createGate({ maxTokens: 1000 });
    gate.record(anthropicUsage(1000, 0));
    gate.reset();
    expect(gate.check().state).toBe("OPEN");
  });

  it("resets token usage to 0", () => {
    const gate = createGate({ maxTokens: 1000 });
    gate.record(anthropicUsage(500, 0));
    gate.reset();
    expect(gate.check().tokens.used).toBe(0);
  });

  it("fires onReset hook", () => {
    const onReset = vi.fn();
    const gate = createGate({ maxTokens: 1000, onReset });
    gate.reset();
    expect(onReset).toHaveBeenCalledOnce();
  });
});

// Hooks

describe("hooks", () => {
  it("fires onThrottled when transitioning to THROTTLED", () => {
    const onThrottled = vi.fn();
    const gate = createGate({ maxTokens: 1000, onThrottled });
    gate.record(anthropicUsage(850, 0));
    expect(onThrottled).toHaveBeenCalledOnce();
  });

  it("fires onThrottled only once per THROTTLED entry", () => {
    const onThrottled = vi.fn();
    const gate = createGate({ maxTokens: 1000, onThrottled });
    gate.record(anthropicUsage(850, 0));
    gate.record(anthropicUsage(10, 0)); // still THROTTLED
    expect(onThrottled).toHaveBeenCalledOnce();
  });

  it("fires onTripped when transitioning to TRIPPED", () => {
    const onTripped = vi.fn();
    const gate = createGate({ maxTokens: 1000, onTripped });
    gate.record(anthropicUsage(1000, 0));
    expect(onTripped).toHaveBeenCalledOnce();
  });

  it("fires onTripped only once per TRIPPED entry", () => {
    const onTripped = vi.fn();
    const gate = createGate({ maxTokens: 1000, onTripped });
    gate.record(anthropicUsage(1000, 0));
    gate.record(anthropicUsage(100, 0)); // already TRIPPED
    expect(onTripped).toHaveBeenCalledOnce();
  });

  it("hook receives correct GateStatus", () => {
    const onTripped = vi.fn();
    const gate = createGate({ maxTokens: 1000, onTripped });
    gate.record(anthropicUsage(1000, 0));
    const status = onTripped.mock.calls[0][0];
    expect(status.state).toBe("TRIPPED");
    expect(status.allowed).toBe(false);
    expect(status.reason).toBe("token_limit_exceeded");
  });
});

// Window Reset

describe("window reset", () => {
  it("resets usage after windowMs elapses", async () => {
    const gate = createGate({ maxTokens: 1000, windowMs: 50 });
    gate.record(anthropicUsage(900, 0));
    expect(gate.check().state).toBe("THROTTLED");

    await new Promise((r) => setTimeout(r, 60));

    expect(gate.check().state).toBe("OPEN");
    expect(gate.check().tokens.used).toBe(0);
  });

  it("fires onReset hook after window elapses", async () => {
    const onReset = vi.fn();
    const gate = createGate({ maxTokens: 1000, windowMs: 50, onReset });
    gate.record(anthropicUsage(1000, 0));

    await new Promise((r) => setTimeout(r, 60));

    gate.check(); // triggers window check
    expect(onReset).toHaveBeenCalled();
  });
});

// Custom Pricing

describe("custom pricing", () => {
  it("uses user-injected pricing over defaults", () => {
    const gate = createGate({
      maxBudget: 1.0,
      pricing: {
        "my-custom-model": { inputPerToken: 0.001, outputPerToken: 0.002 },
      },
    });
    gate.record({
      model: "my-custom-model",
      inputTokens: 100,
      outputTokens: 50,
    });
    const status = gate.check();
    // 100 * 0.001 + 50 * 0.002 = 0.1 + 0.1 = 0.2
    expect(status.budget.used).toBeCloseTo(0.2);
  });
});
