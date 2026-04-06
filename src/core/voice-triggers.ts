import { VoiceEvent } from "./types";
import { formatDuration, formatDistance } from "./geo";

export interface VoiceCallout {
  event: VoiceEvent;
  text: string;
}

/** Build the text for a voice callout. */
export function buildCallout(
  event: VoiceEvent,
  elapsedSeconds: number,
  distanceMeters: number,
): VoiceCallout {
  const time = formatDuration(elapsedSeconds);
  const dist = formatDistance(distanceMeters);

  switch (event) {
    case "start":
      return { event, text: "Run started. Let's go!" };
    case "halfway":
      return { event, text: `Halfway. ${dist} covered in ${time}.` };
    case "finish":
      return { event, text: `Run complete. ${dist} in ${time}. Nice work!` };
  }
}

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
): VoiceEvent[] {
  const events: VoiceEvent[] = [];

  if (targetDistanceMeters != null && targetDistanceMeters > 0) {
    if (
      distanceMeters >= targetDistanceMeters / 2 &&
      !alreadyFired.has("halfway")
    ) {
      events.push("halfway");
    }
  }

  return events;
}
