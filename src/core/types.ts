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
  deletedAt: string | null; // ISO 8601, null = active
}

export type Period = "week" | "month" | "year";

export interface Summary {
  period: Period;
  label: string; // e.g. "2026-W15", "2026-04", "2026"
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  runCount: number;
}

export type VoiceEvent = "start" | "finish";

export type TargetDurationMinutes = number;
