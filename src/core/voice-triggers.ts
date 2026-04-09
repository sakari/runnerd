import { VoiceEvent } from "./types";

/**
 * Determine which distance-based voice events should fire given the current state.
 * Returns events that haven't been announced yet.
 *
 * Time-based triggers (time-halfway, finish) are handled by OS notifications
 * via time-notifications.ts — they don't belong here because the GPS callback
 * doesn't fire reliably on iOS when stationary.
 */
export function checkTriggers(
  distanceMeters: number,
  targetDistanceMeters: number | null,
  alreadyFired: Set<VoiceEvent>,
): VoiceEvent[] {
  const events: VoiceEvent[] = [];

  if (targetDistanceMeters != null && targetDistanceMeters > 0) {
    if (distanceMeters >= targetDistanceMeters / 2 && !alreadyFired.has("halfway")) {
      events.push("halfway");
    }
  }

  return events;
}
