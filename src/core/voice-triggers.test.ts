import { describe, it, expect } from "vitest";
import { checkTriggers } from "./voice-triggers";

describe("checkTriggers", () => {
  it("returns nothing without a target", () => {
    expect(checkTriggers(2500, null, new Set())).toEqual([]);
  });

  it("returns halfway when past half of target", () => {
    const events = checkTriggers(2600, 5000, new Set());
    expect(events).toContain("halfway");
  });

  it("does not re-fire halfway", () => {
    const events = checkTriggers(2600, 5000, new Set(["halfway"]));
    expect(events).not.toContain("halfway");
  });

  it("does not fire halfway before half distance", () => {
    const events = checkTriggers(1000, 5000, new Set());
    expect(events).toEqual([]);
  });

  it("returns time-halfway when past half of target duration", () => {
    const events = checkTriggers(0, null, new Set(), 910, 1800);
    expect(events).toContain("time-halfway");
  });

  it("does not fire time-halfway before half duration", () => {
    const events = checkTriggers(0, null, new Set(), 800, 1800);
    expect(events).toEqual([]);
  });

  it("does not re-fire time-halfway", () => {
    const events = checkTriggers(0, null, new Set(["time-halfway"]), 910, 1800);
    expect(events).not.toContain("time-halfway");
  });

  it("does not fire time-halfway without target duration", () => {
    const events = checkTriggers(0, null, new Set(), 910, null);
    expect(events).toEqual([]);
  });
});
