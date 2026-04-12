import { VoiceEvent } from "../core/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const letsGo = require("../../assets/callouts/lets-go.wav");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const timesUp = require("../../assets/callouts/times_up.wav");

const calloutAssets: Record<VoiceEvent, number> = {
  start: letsGo,
  finish: timesUp,
};

export default calloutAssets;
