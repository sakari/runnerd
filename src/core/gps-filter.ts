import { GeoPoint } from "./types";

/**
 * Constant-velocity Kalman filter state for a single axis.
 * Tracks both position and velocity to predict movement and reduce
 * noise-induced zigzag in distance calculations.
 */
interface AxisState {
  position: number; // degrees
  velocity: number; // degrees per second
  // 2x2 covariance matrix [P00, P01, P10, P11]
  P00: number;
  P01: number;
  P10: number;
  P11: number;
}

/**
 * GPS filter that smooths noisy GPS points using a constant-velocity
 * Kalman filter with a speed gate and minimum-displacement dead zone.
 *
 * The constant-velocity model predicts where the runner *will be* next,
 * not just where they were. This reduces:
 * - Noise zigzag (smoother path → less inflated distance)
 * - Speed gate false positives (prediction tracks real movement)
 * - Stationary drift (dead zone suppresses sub-threshold jitter)
 */
export class GpsFilter {
  private latState: AxisState | null = null;
  private lonState: AxisState | null = null;
  private lastTimestamp: number | null = null;

  /** Previous raw point for speed gate (raw-to-raw comparison). */
  private lastRawLat: number | null = null;
  private lastRawLon: number | null = null;

  /** Last emitted position for dead-zone check. */
  private lastEmittedLat: number | null = null;
  private lastEmittedLon: number | null = null;

  // Tuning parameters
  private readonly measurementNoise: number; // R — GPS position error variance in degrees²
  private readonly positionProcessNoise: number; // position process noise per second
  private readonly velocityProcessNoise: number; // velocity process noise per second

  /** Max plausible running speed in m/s. Points implying faster speed are rejected. */
  private readonly maxSpeedMs: number;

  /** Minimum displacement in meters to count as real movement. */
  private readonly minDisplacementMeters: number;

  constructor(
    opts: {
      /** GPS accuracy in meters. Default 5. */
      accuracyMeters?: number;
      /** Max plausible speed in m/s. Default 12 (~43 km/h, sprint). */
      maxSpeedMs?: number;
      /** Minimum displacement in meters to emit a new position. Default 8. */
      minDisplacementMeters?: number;
    } = {},
  ) {
    const accuracy = opts.accuracyMeters ?? 5;
    this.maxSpeedMs = opts.maxSpeedMs ?? 12;
    this.minDisplacementMeters = opts.minDisplacementMeters ?? 8;

    // Convert meter accuracy to approximate degree variance.
    // Scale up by 1.5x for extra smoothing — the constant-velocity model
    // tracks real movement via velocity prediction despite the higher R.
    const degAccuracy = (accuracy * 1.5) / 111_000;
    this.measurementNoise = degAccuracy * degAccuracy;

    // Process noise for position: small — most position change comes from velocity
    this.positionProcessNoise = (0.5 / 111_000) ** 2; // 0.5 m/s equivalent

    // Process noise for velocity: how much acceleration a runner can have per second.
    // Lower values make velocity decay toward zero faster when stationary,
    // reducing phantom drift from noise. 0.1 m/s² keeps velocity stable
    // enough for running while suppressing noise-driven momentum.
    this.velocityProcessNoise = (0.1 / 111_000) ** 2;
  }

  /**
   * Feed a raw GPS point through the filter.
   * Returns the smoothed point, or null if the point was rejected (speed spike).
   */
  process(raw: GeoPoint): GeoPoint | null {
    // Speed gate: compare consecutive raw points to detect impossible GPS jumps.
    // Using raw-to-raw rather than predicted-to-raw avoids false rejections
    // during filter convergence (when velocity hasn't ramped up yet).
    if (this.lastRawLat != null && this.lastRawLon != null && this.lastTimestamp != null) {
      const dt = (raw.timestamp - this.lastTimestamp) / 1000;
      if (dt > 0) {
        const dlat = (raw.latitude - this.lastRawLat) * 111_000;
        const dlon =
          (raw.longitude - this.lastRawLon) *
          111_000 *
          Math.cos((raw.latitude * Math.PI) / 180);
        const dist = Math.sqrt(dlat * dlat + dlon * dlon);
        const speed = dist / dt;
        if (speed > this.maxSpeedMs) {
          // Don't update lastRaw or lastTimestamp — keep comparing to last
          // accepted raw point with correct dt to avoid cascading rejection.
          return null;
        }
      }
    }
    this.lastRawLat = raw.latitude;
    this.lastRawLon = raw.longitude;

    const dt =
      this.lastTimestamp != null ? Math.max((raw.timestamp - this.lastTimestamp) / 1000, 0.1) : 1;
    this.lastTimestamp = raw.timestamp;

    this.latState = this.updateAxis(this.latState, raw.latitude, dt);
    this.lonState = this.updateAxis(this.lonState, raw.longitude, dt);

    // Dead zone: suppress sub-threshold movements to prevent stationary drift
    if (this.lastEmittedLat != null && this.lastEmittedLon != null) {
      const movedLat = (this.latState.position - this.lastEmittedLat) * 111_000;
      const movedLon =
        (this.lonState.position - this.lastEmittedLon) *
        111_000 *
        Math.cos((this.latState.position * Math.PI) / 180);
      const moved = Math.sqrt(movedLat * movedLat + movedLon * movedLon);
      if (moved < this.minDisplacementMeters) {
        return {
          latitude: this.lastEmittedLat,
          longitude: this.lastEmittedLon,
          timestamp: raw.timestamp,
        };
      }
    }

    this.lastEmittedLat = this.latState.position;
    this.lastEmittedLon = this.lonState.position;

    return {
      latitude: this.latState.position,
      longitude: this.lonState.position,
      timestamp: raw.timestamp,
    };
  }

  /** Reset the filter (e.g. when starting a new run). */
  reset(): void {
    this.latState = null;
    this.lonState = null;
    this.lastTimestamp = null;
    this.lastRawLat = null;
    this.lastRawLon = null;
    this.lastEmittedLat = null;
    this.lastEmittedLon = null;
  }

  /**
   * Constant-velocity Kalman filter update for one axis.
   *
   * State: [position, velocity]
   * Transition: position' = position + velocity * dt, velocity' = velocity
   * Observation: we only measure position (H = [1, 0])
   */
  private updateAxis(state: AxisState | null, measurement: number, dt: number): AxisState {
    if (state == null) {
      return {
        position: measurement,
        velocity: 0,
        P00: this.measurementNoise,
        P01: 0,
        P10: 0,
        P11: this.velocityProcessNoise,
      };
    }

    // === Predict ===
    // x_pred = F * x  where F = [[1, dt], [0, 1]]
    const predPos = state.position + state.velocity * dt;
    const predVel = state.velocity;

    // P_pred = F * P * F^T + Q
    const qPos = this.positionProcessNoise * dt;
    const qVel = this.velocityProcessNoise * dt;

    const pp00 = state.P00 + dt * (state.P10 + state.P01) + dt * dt * state.P11 + qPos;
    const pp01 = state.P01 + dt * state.P11;
    const pp10 = state.P10 + dt * state.P11;
    const pp11 = state.P11 + qVel;

    // === Update ===
    // H = [1, 0], so innovation = measurement - predPos
    const innovation = measurement - predPos;

    // S = H * P_pred * H^T + R = P_pred[0][0] + R
    const S = pp00 + this.measurementNoise;

    // K = P_pred * H^T / S = [P_pred[0][0] / S, P_pred[1][0] / S]
    const K0 = pp00 / S;
    const K1 = pp10 / S;

    return {
      position: predPos + K0 * innovation,
      velocity: predVel + K1 * innovation,
      // P = (I - K*H) * P_pred
      P00: (1 - K0) * pp00,
      P01: (1 - K0) * pp01,
      P10: pp10 - K1 * pp00,
      P11: pp11 - K1 * pp01,
    };
  }
}
