import { describe, it, expect } from "vitest";
import { periodLabel, summarize } from "./summaries";
import { Run } from "./types";

describe("periodLabel", () => {
  it("returns week label", () => {
    const label = periodLabel("2026-04-06T10:00:00Z", "week");
    expect(label).toMatch(/^2026-W\d{2}$/);
  });

  it("returns month label", () => {
    expect(periodLabel("2026-04-06T10:00:00Z", "month")).toBe("2026-04");
  });

  it("returns year label", () => {
    expect(periodLabel("2026-04-06T10:00:00Z", "year")).toBe("2026");
  });
});

describe("summarize", () => {
  const runs: Run[] = [
    {
      id: 1,
      startedAt: "2026-04-01T08:00:00Z",
      finishedAt: "2026-04-01T08:30:00Z",
      distanceMeters: 5000,
      durationSeconds: 1800,
    },
    {
      id: 2,
      startedAt: "2026-04-03T08:00:00Z",
      finishedAt: "2026-04-03T08:25:00Z",
      distanceMeters: 4500,
      durationSeconds: 1500,
    },
    {
      id: 3,
      startedAt: "2026-03-15T08:00:00Z",
      finishedAt: "2026-03-15T09:00:00Z",
      distanceMeters: 10000,
      durationSeconds: 3600,
    },
  ];

  it("groups by month", () => {
    const s = summarize(runs, "month");
    expect(s).toHaveLength(2);
    const april = s.find((x) => x.label === "2026-04");
    expect(april).toBeDefined();
    expect(april!.runCount).toBe(2);
    expect(april!.totalDistanceMeters).toBe(9500);
    expect(april!.totalDurationSeconds).toBe(3300);
  });

  it("groups by year", () => {
    const s = summarize(runs, "year");
    expect(s).toHaveLength(1);
    expect(s[0].runCount).toBe(3);
    expect(s[0].totalDistanceMeters).toBe(19500);
  });

  it("returns empty for no runs", () => {
    expect(summarize([], "week")).toEqual([]);
  });
});
