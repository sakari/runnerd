import { describe, it, expect } from "vitest";
import { buildCallout, checkTriggers } from "./voice-triggers";

describe("buildCallout", () => {
  it("builds start callout", () => {
    const c = buildCallout("start", 0, 0);
    expect(c.event).toBe("start");
    expect(c.text).toContain("started");
  });

  it("builds halfway callout with stats", () => {
    const c = buildCallout("halfway", 900, 2500);
    expect(c.event).toBe("halfway");
    expect(c.text).toContain("Halfway");
    expect(c.text).toContain("2.50 km");
  });

  it("builds time-halfway callout with stats", () => {
    const c = buildCallout("time-halfway", 900, 2500);
    expect(c.event).toBe("time-halfway");
    expect(c.text).toContain("Halfway");
    expect(c.text).toContain("15:00");
  });

  it("builds finish callout with stats", () => {
    const c = buildCallout("finish", 1800, 5000);
    expect(c.event).toBe("finish");
    expect(c.text).toContain("complete");
    expect(c.text).toContain("5.00 km");
  });
});

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
