// Isolated so tests can vi.mock this module — vitest can't parse wav requires.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const silentTrack: number = require("../../assets/callouts/silent.wav");
export default silentTrack;
