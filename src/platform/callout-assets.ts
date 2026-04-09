import { VoiceEvent } from "../core/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const letsGo = require("../../assets/callouts/lets-go.wav");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const halfway = require("../../assets/callouts/halfway.wav");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const timesUp = require("../../assets/callouts/times-up.wav");

const calloutAssets: Record<VoiceEvent, number> = {
  start: letsGo,
  halfway: halfway,
  finish: timesUp,
};

export default calloutAssets;
