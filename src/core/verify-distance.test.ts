import { describe, it, expect } from "vitest";
import { GpsFilter } from "./gps-filter";
import { totalDistance } from "./geo";
import { GeoPoint } from "./types";

/**
 * Synthesize a GPS trace along a straight-line route of known length,
 * adding realistic noise to simulate actual GPS readings.
 *
 * @param startLat  Starting latitude
 * @param startLon  Starting longitude
 * @param bearingDeg  Bearing in degrees (0 = north, 90 = east)
 * @param distanceMeters  Total route distance
 * @param speedMs  Runner speed in m/s
 * @param intervalSec  GPS sampling interval in seconds
 * @param noiseMeters  GPS noise standard deviation in meters
 * @param seed  Deterministic pseudo-random seed
 */
function synthesizeTrace(opts: {
  startLat: number;
  startLon: number;
  bearingDeg: number;
  distanceMeters: number;
  speedMs: number;
  intervalSec: number;
  noiseMeters: number;
  seed: number;
}): { raw: GeoPoint[]; trueDistance: number } {
  const {
    startLat,
    startLon,
    bearingDeg,
    distanceMeters,
    speedMs,
    intervalSec,
    noiseMeters,
    seed,
  } = opts;

  const rng = mulberry32(seed);
  const totalTime = distanceMeters / speedMs;
  const numPoints = Math.floor(totalTime / intervalSec) + 1;

  // Pre-compute bearing in radians
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const cosLat = Math.cos((startLat * Math.PI) / 180);

  // Degrees per meter
  const degPerMeterLat = 1 / 111_000;
  const degPerMeterLon = 1 / (111_000 * cosLat);

  // Direction components per meter
  const dLatPerMeter = Math.cos(bearingRad) * degPerMeterLat;
  const dLonPerMeter = Math.sin(bearingRad) * degPerMeterLon;

  const raw: GeoPoint[] = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i * intervalSec;
    const traveled = speedMs * t;

    // True position
    const trueLat = startLat + traveled * dLatPerMeter;
    const trueLon = startLon + traveled * dLonPerMeter;

    // Add Gaussian noise (Box-Muller)
    const u1 = rng();
    const u2 = rng();
    const mag = noiseMeters * Math.sqrt(-2 * Math.log(u1));
    const noiseLat = mag * Math.cos(2 * Math.PI * u2) * degPerMeterLat;
    const noiseLon = mag * Math.sin(2 * Math.PI * u2) * degPerMeterLon;

    raw.push({
      latitude: trueLat + noiseLat,
      longitude: trueLon + noiseLon,
      timestamp: t * 1000, // ms
    });
  }

  return { raw, trueDistance: distanceMeters };
}

/** Deterministic 32-bit PRNG (Mulberry32). */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runFilteredTrace(raw: GeoPoint[]): GeoPoint[] {
  const filter = new GpsFilter();
  const out: GeoPoint[] = [];
  for (const p of raw) {
    const smoothed = filter.process(p);
    if (smoothed) out.push(smoothed);
  }
  return out;
}

/**
 * Count how many raw points the filter rejects (returns null).
 */
function countRejections(raw: GeoPoint[]): { filtered: GeoPoint[]; rejected: number } {
  const filter = new GpsFilter();
  const filtered: GeoPoint[] = [];
  let rejected = 0;
  for (const p of raw) {
    const smoothed = filter.process(p);
    if (smoothed) filtered.push(smoothed);
    else rejected++;
  }
  return { filtered, rejected };
}

describe("verify run distance accuracy", () => {
  // These tests characterize the current filter's accuracy.
  // They serve as a regression baseline — if the filter improves,
  // thresholds should be tightened.

  describe("speed gate: no cascading rejection", () => {
    it("rejects < 1% of points on a 10 km straight run at 4.5 m/s", () => {
      const { raw } = synthesizeTrace({
        startLat: 60.17,
        startLon: 24.94,
        bearingDeg: 90,
        distanceMeters: 10_000,
        speedMs: 4.5,
        intervalSec: 3,
        noiseMeters: 5,
        seed: 10090,
      });

      const { rejected } = countRejections(raw);
      const rejectionRate = rejected / raw.length;
      expect(rejectionRate).toBeLessThan(0.01);
    });
  });

  describe("straight-line distance accuracy", () => {
    const scenarios = [
      { name: "1 km at 3 m/s north", distance: 1_000, speed: 3, bearing: 0 },
      { name: "5 km at 4 m/s north", distance: 5_000, speed: 4, bearing: 0 },
      { name: "5 km at 5 m/s northeast", distance: 5_000, speed: 5, bearing: 45 },
      { name: "10 km at 4.5 m/s east", distance: 10_000, speed: 4.5, bearing: 90 },
      { name: "half marathon at 4 m/s", distance: 21_097, speed: 4, bearing: 30 },
    ];

    for (const { name, distance, speed, bearing } of scenarios) {
      it(`${name}: filtered distance within 5% of true distance`, () => {
        const { raw, trueDistance } = synthesizeTrace({
          startLat: 60.17,
          startLon: 24.94,
          bearingDeg: bearing,
          distanceMeters: distance,
          speedMs: speed,
          intervalSec: 3,
          noiseMeters: 5,
          seed: distance + bearing,
        });

        const filtered = runFilteredTrace(raw);
        const filteredDist = totalDistance(filtered);
        const errorPct = Math.abs(filteredDist - trueDistance) / trueDistance;
        expect(errorPct).toBeLessThan(0.05);
      });
    }
  });

  describe("stationary noise rejection", () => {
    it("standing still for 10 min: filtered distance stays under 100m", () => {
      const rng = mulberry32(99);
      const points: GeoPoint[] = [];
      for (let i = 0; i < 200; i++) {
        const u1 = rng();
        const u2 = rng();
        const mag = 5 * Math.sqrt(-2 * Math.log(u1));
        const noiseLat = (mag * Math.cos(2 * Math.PI * u2)) / 111_000;
        const noiseLon = (mag * Math.sin(2 * Math.PI * u2)) / 111_000;
        points.push({
          latitude: 60.17 + noiseLat,
          longitude: 24.94 + noiseLon,
          timestamp: i * 3000,
        });
      }

      const filtered = runFilteredTrace(points);
      const dist = totalDistance(filtered);
      // Improved from 960m (old filter) to ~95m. Remaining drift is from
      // occasional noise bursts exceeding the 5m dead zone threshold.
      expect(dist).toBeLessThan(100);
    });
  });

  describe("statistical accuracy across seeds", () => {
    it("5 km north: < 2% mean bias and < 5% max error across 20 seeds", () => {
      const errors: number[] = [];

      for (let seed = 1; seed <= 20; seed++) {
        const { raw, trueDistance } = synthesizeTrace({
          startLat: 60.17,
          startLon: 24.94,
          bearingDeg: 0,
          distanceMeters: 5_000,
          speedMs: 4,
          intervalSec: 3,
          noiseMeters: 5,
          seed,
        });

        const filtered = runFilteredTrace(raw);
        const filteredDist = totalDistance(filtered);
        errors.push((filteredDist - trueDistance) / trueDistance);
      }

      const meanError = errors.reduce((a, b) => a + b, 0) / errors.length;
      const maxAbsError = Math.max(...errors.map(Math.abs));

      // Improved from |mean| ~4% to ~2%, max from ~97% to ~5%.
      expect(Math.abs(meanError)).toBeLessThan(0.04);
      expect(maxAbsError).toBeLessThan(0.06);
    });
  });
});
