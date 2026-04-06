import { GeoPoint } from "./types";

/**
 * Simple 1D Kalman filter state for a single axis.
 * We run two independent filters — one for latitude, one for longitude.
 */
interface KalmanState {
  estimate: number;
  uncertainty: number; // P — estimate uncertainty
}

/**
 * GPS Kalman filter that smooths noisy GPS points.
 *
 * Process noise (Q) controls how quickly the filter adapts to real movement.
 * Measurement noise (R) represents expected GPS error variance.
 * Higher R = more smoothing, slower response to real movement.
 */
export class GpsFilter {
  private latState: KalmanState | null = null;
  private lonState: KalmanState | null = null;
  private lastTimestamp: number | null = null;

  // Tuning parameters
  private readonly measurementNoise: number; // R — GPS error variance in degrees²
  private readonly processNoisePerSecond: number; // Q growth rate per second

  /** Max plausible running speed in m/s. Points implying faster speed are rejected. */
  private readonly maxSpeedMs: number;

  constructor(
    opts: {
      /** GPS accuracy in meters. Default 5. */
      accuracyMeters?: number;
      /** Max plausible speed in m/s. Default 12 (~43 km/h, sprint). */
      maxSpeedMs?: number;
    } = {},
  ) {
    const accuracy = opts.accuracyMeters ?? 5;
    this.maxSpeedMs = opts.maxSpeedMs ?? 12;

    // Convert meter accuracy to approximate degree variance
    // 1 degree latitude ≈ 111,000 m, so accuracy in degrees ≈ accuracy / 111000
    const degAccuracy = accuracy / 111_000;
    this.measurementNoise = degAccuracy * degAccuracy;

    // Process noise: how much real position can change per second
    // A runner at ~5 m/s ≈ 0.000045 deg/s. We square that for variance.
    const runnerSpeedDeg = 5 / 111_000;
    this.processNoisePerSecond = runnerSpeedDeg * runnerSpeedDeg;
  }

  /**
   * Feed a raw GPS point through the filter.
   * Returns the smoothed point, or null if the point was rejected (speed spike).
   */
  process(raw: GeoPoint): GeoPoint | null {
    // Speed gate: reject points that imply impossible speed
    if (this.latState != null && this.lonState != null && this.lastTimestamp != null) {
      const dt = (raw.timestamp - this.lastTimestamp) / 1000; // seconds
      if (dt > 0) {
        const dlat = (raw.latitude - this.latState.estimate) * 111_000;
        const dlon =
          (raw.longitude - this.lonState.estimate) *
          111_000 *
          Math.cos((this.latState.estimate * Math.PI) / 180);
        const dist = Math.sqrt(dlat * dlat + dlon * dlon);
        const speed = dist / dt;
        if (speed > this.maxSpeedMs) {
          return null; // reject this point
        }
      }
    }

    const dt =
      this.lastTimestamp != null
        ? Math.max((raw.timestamp - this.lastTimestamp) / 1000, 0.1)
        : 1;
    this.lastTimestamp = raw.timestamp;

    const processNoise = this.processNoisePerSecond * dt;

    this.latState = this.update1d(this.latState, raw.latitude, processNoise);
    this.lonState = this.update1d(this.lonState, raw.longitude, processNoise);

    return {
      latitude: this.latState.estimate,
      longitude: this.lonState.estimate,
      timestamp: raw.timestamp,
    };
  }

  /** Reset the filter (e.g. when starting a new run). */
  reset(): void {
    this.latState = null;
    this.lonState = null;
    this.lastTimestamp = null;
  }

  private update1d(
    state: KalmanState | null,
    measurement: number,
    processNoise: number,
  ): KalmanState {
    if (state == null) {
      // Initialize with first measurement
      return { estimate: measurement, uncertainty: this.measurementNoise };
    }

    // Predict: uncertainty grows by process noise
    const predictedUncertainty = state.uncertainty + processNoise;

    // Update: Kalman gain
    const K = predictedUncertainty / (predictedUncertainty + this.measurementNoise);

    return {
      estimate: state.estimate + K * (measurement - state.estimate),
      uncertainty: (1 - K) * predictedUncertainty,
    };
  }
}
