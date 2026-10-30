import { NUDGE_BODIES, nextNudgeAt, pickNudgeBody } from '../logic';

const NOW = new Date(2026, 9, 30, 23, 50); // late evening, Fri 30 Oct 2026
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(a) - startOfDay(b)) / 86_400_000);
const minutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

describe('nextNudgeAt', () => {
  it('lowest rng gives 10:00 two days later', () => {
    const at = nextNudgeAt(NOW, () => 0);
    expect(dayDiff(at, NOW)).toBe(2);
    expect(minutes(at)).toBe(10 * 60);
  });

  it('highest rng gives 20:30 five days later', () => {
    const at = nextNudgeAt(NOW, () => 0.999999);
    expect(dayDiff(at, NOW)).toBe(5);
    expect(minutes(at)).toBe(20 * 60 + 30);
  });

  it('always lands inside the window and day range', () => {
    let seed = 42;
    const rng = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 500; i++) {
      const at = nextNudgeAt(NOW, rng);
      expect(dayDiff(at, NOW)).toBeGreaterThanOrEqual(2);
      expect(dayDiff(at, NOW)).toBeLessThanOrEqual(5);
      expect(minutes(at)).toBeGreaterThanOrEqual(600);
      expect(minutes(at)).toBeLessThanOrEqual(1230);
      expect(at.getTime()).toBeGreaterThan(NOW.getTime());
    }
  });

  it('crosses month ends', () => {
    expect(nextNudgeAt(NOW, () => 0.99).getMonth()).toBe(10);
  });
});

describe('pickNudgeBody', () => {
  it('picks from the list at both ends', () => {
    expect(pickNudgeBody(() => 0)).toBe(NUDGE_BODIES[0]);
    expect(pickNudgeBody(() => 0.999999)).toBe(NUDGE_BODIES[NUDGE_BODIES.length - 1]);
  });
});
