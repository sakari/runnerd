import { describe, it, expect } from "vitest";
import {
  haversine,
  totalDistance,
  avgSpeed,
  paceMinPerKm,
  formatDuration,
  formatDistance,
  formatPace,
} from "./geo";
import { GeoPoint } from "./types";

const helsinki: GeoPoint = { latitude: 60.1699, longitude: 24.9384, timestamp: 0 };
const espoo: GeoPoint = { latitude: 60.2055, longitude: 24.6559, timestamp: 0 };

describe("haversine", () => {
  it("returns 0 for same point", () => {
    expect(haversine(helsinki, helsinki)).toBe(0);
  });

  it("computes Helsinki-Espoo ~15 km", () => {
    const d = haversine(helsinki, espoo);
    expect(d).toBeGreaterThan(14_000);
    expect(d).toBeLessThan(17_000);
  });
});

describe("totalDistance", () => {
  it("returns 0 for empty or single point", () => {
    expect(totalDistance([])).toBe(0);
    expect(totalDistance([helsinki])).toBe(0);
  });

  it("sums segment distances", () => {
    const mid: GeoPoint = { latitude: 60.19, longitude: 24.8, timestamp: 0 };
    const d = totalDistance([helsinki, mid, espoo]);
    const direct = haversine(helsinki, espoo);
    // Path via mid should be >= direct
    expect(d).toBeGreaterThanOrEqual(direct - 1);
  });
});

describe("avgSpeed", () => {
  it("returns 0 for zero duration", () => {
    expect(avgSpeed(1000, 0)).toBe(0);
  });

  it("computes correctly", () => {
    expect(avgSpeed(1000, 200)).toBeCloseTo(5, 5);
  });
});

describe("paceMinPerKm", () => {
  it("returns 0 for zero distance", () => {
    expect(paceMinPerKm(0, 300)).toBe(0);
  });

  it("5 min/km for 1km in 300s", () => {
    expect(paceMinPerKm(1000, 300)).toBeCloseTo(5, 5);
  });
});

describe("formatDuration", () => {
  it("formats under an hour", () => {
    expect(formatDuration(125)).toBe("02:05");
  });

  it("formats over an hour", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});

describe("formatDistance", () => {
  it("formats meters", () => {
    expect(formatDistance(850)).toBe("850 m");
  });

  it("formats kilometers", () => {
    expect(formatDistance(5432)).toBe("5.43 km");
  });
});

describe("formatPace", () => {
  it("returns placeholder for zero distance", () => {
    expect(formatPace(0, 100)).toBe("--:-- /km");
  });

  it("formats 5:00 /km", () => {
    expect(formatPace(1000, 300)).toBe("5:00 /km");
  });
});
