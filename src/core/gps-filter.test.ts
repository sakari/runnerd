import { describe, it, expect } from "vitest";
import { GpsFilter } from "./gps-filter";
import { GeoPoint } from "./types";
import { totalDistance } from "./geo";

function makePoint(lat: number, lon: number, timestamp: number): GeoPoint {
  return { latitude: lat, longitude: lon, timestamp };
}

describe("GpsFilter", () => {
  it("passes through the first point unchanged", () => {
    const f = new GpsFilter();
    const p = makePoint(60.17, 24.94, 1000);
    const result = f.process(p);
    expect(result).not.toBeNull();
    expect(result!.latitude).toBe(60.17);
    expect(result!.longitude).toBe(24.94);
  });

  it("smooths noisy points toward the true path", () => {
    const f = new GpsFilter();
    // Simulate standing still at (60.17, 24.94) with noise
    const truePoint = { lat: 60.17, lon: 24.94 };
    const results: GeoPoint[] = [];

    for (let i = 0; i < 20; i++) {
      const noise = (Math.random() - 0.5) * 0.0001; // ~5m noise
      const raw = makePoint(
        truePoint.lat + noise,
        truePoint.lon + noise,
        i * 3000,
      );
      const smoothed = f.process(raw);
      if (smoothed) results.push(smoothed);
    }

    // Smoothed points should be closer to true position than raw noise range
    const lastSmoothed = results[results.length - 1];
    const latError = Math.abs(lastSmoothed.latitude - truePoint.lat);
    const lonError = Math.abs(lastSmoothed.longitude - truePoint.lon);
    // After 20 points, the filter should converge well within noise range
    expect(latError).toBeLessThan(0.00005); // ~5m
    expect(lonError).toBeLessThan(0.00005);
  });

  it("reduces distance overestimate from noisy stationary points", () => {
    const f = new GpsFilter();
    const truePoint = { lat: 60.17, lon: 24.94 };
    const rawPoints: GeoPoint[] = [];
    const smoothedPoints: GeoPoint[] = [];

    for (let i = 0; i < 30; i++) {
      const noise = (Math.random() - 0.5) * 0.0001;
      const raw = makePoint(
        truePoint.lat + noise,
        truePoint.lon + noise,
        i * 3000,
      );
      rawPoints.push(raw);
      const smoothed = f.process(raw);
      if (smoothed) smoothedPoints.push(smoothed);
    }

    const rawDist = totalDistance(rawPoints);
    const smoothedDist = totalDistance(smoothedPoints);

    // Standing still: true distance is 0.
    // Smoothed distance should be much less than raw noisy distance.
    expect(smoothedDist).toBeLessThan(rawDist);
  });

  it("rejects speed spikes (GPS jumps)", () => {
    const f = new GpsFilter();
    f.process(makePoint(60.17, 24.94, 0));
    f.process(makePoint(60.17001, 24.94001, 3000));

    // Jump 1 km in 3 seconds = ~333 m/s — clearly impossible
    const spike = f.process(makePoint(60.18, 24.94, 6000));
    expect(spike).toBeNull();

    // Next normal point should still work
    const normal = f.process(makePoint(60.17002, 24.94002, 9000));
    expect(normal).not.toBeNull();
  });

  it("allows normal running speed", () => {
    const f = new GpsFilter();
    // ~5 m/s runner heading north
    // 5 m/s ≈ 0.000045 deg/s latitude
    const results: GeoPoint[] = [];
    for (let i = 0; i < 10; i++) {
      const point = makePoint(60.17 + i * 0.000135, 24.94, i * 3000);
      const smoothed = f.process(point);
      if (smoothed) results.push(smoothed);
    }

    // All 10 points should be accepted
    expect(results).toHaveLength(10);

    // Total distance should be roughly 10 * 15m = 150m (give or take smoothing)
    const dist = totalDistance(results);
    expect(dist).toBeGreaterThan(50);
    expect(dist).toBeLessThan(200);
  });

  it("reset clears state for a new run", () => {
    const f = new GpsFilter();
    f.process(makePoint(60.17, 24.94, 0));
    f.reset();

    // After reset, a far-away point should be accepted (no prior state to compare)
    const result = f.process(makePoint(61.0, 25.0, 10000));
    expect(result).not.toBeNull();
    expect(result!.latitude).toBe(61.0);
  });
});
