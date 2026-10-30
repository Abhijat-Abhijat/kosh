export const NUDGE_ID = 'kosh-nudge';

export const NUDGE_BODIES = [
  'Spent anything in cash? Add it in Kosh.',
  'Any payments due this week? Take a quick look.',
  'Still using all your subscriptions? Check in Kosh.',
  'A two-minute check-in keeps your numbers honest.',
  'Moved money between accounts? Log it in Kosh.',
];

const WINDOW_START = 10 * 60; // 10:00
const WINDOW_END = 20 * 60 + 30; // 20:30

/** Random local time 10:00–20:30, 2–5 days after `now`. `rng` returns [0, 1). */
export function nextNudgeAt(now: Date, rng: () => number = Math.random): Date {
  const days = 2 + Math.floor(rng() * 4);
  const minute = WINDOW_START + Math.floor(rng() * (WINDOW_END - WINDOW_START + 1));
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 0, minute, 0, 0);
}

export function pickNudgeBody(rng: () => number = Math.random) {
  return NUDGE_BODIES[Math.floor(rng() * NUDGE_BODIES.length)];
}
