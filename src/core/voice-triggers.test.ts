import { describe, it, expect } from "vitest";
import { checkTriggers } from "./voice-triggers";

describe("checkTriggers", () => {
  it("returns nothing without a target", () => {
    expect(checkTriggers(2500, null, new Set())).toEqual([]);
  });

  it("returns halfway when past half of target distance", () => {
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
});
