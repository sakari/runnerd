import { VoiceEvent } from "./types";

/**
 * Determine which voice events should fire given the current state.
 * Returns events that haven't been announced yet.
 *
 * Halfway triggers when distance >= targetDistance / 2 (only if target is set).
 */
export function checkTriggers(
  distanceMeters: number,
  targetDistanceMeters: number | null,
  alreadyFired: Set<VoiceEvent>,
  elapsedSeconds?: number,
  targetDurationSeconds?: number | null,
): VoiceEvent[] {
  const events: VoiceEvent[] = [];

  if (targetDistanceMeters != null && targetDistanceMeters > 0) {
    if (distanceMeters >= targetDistanceMeters / 2 && !alreadyFired.has("halfway")) {
      events.push("halfway");
    }
  }

  if (targetDurationSeconds != null && targetDurationSeconds > 0 && elapsedSeconds != null) {
    if (elapsedSeconds >= targetDurationSeconds / 2 && !alreadyFired.has("time-halfway")) {
      events.push("time-halfway");
    }
  }

  return events;
}
