export interface GeoPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface Run {
  id: number;
  startedAt: string; // ISO 8601
  finishedAt: string | null;
  distanceMeters: number;
  durationSeconds: number;
}

export type Period = "week" | "month" | "year";

export interface Summary {
  period: Period;
  label: string; // e.g. "2026-W15", "2026-04", "2026"
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  runCount: number;
}

export type VoiceEvent = "start" | "halfway" | "finish";

export interface RunState {
  isRunning: boolean;
  startTime: number | null;
  elapsedSeconds: number;
  distanceMeters: number;
  points: GeoPoint[];
  targetDistanceMeters: number | null;
}
