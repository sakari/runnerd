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
});
