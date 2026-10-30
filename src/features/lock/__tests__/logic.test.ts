import { shouldLock } from '../logic';

const T = 1_700_000_000_000;

describe('shouldLock', () => {
  it('never locks without a background timestamp', () => {
    expect(shouldLock(null, T, 'immediate')).toBe(false);
  });

  it('locks immediately on any return when timeout is immediate', () => {
    expect(shouldLock(T, T, 'immediate')).toBe(true);
    expect(shouldLock(T, T + 500, 'immediate')).toBe(true);
  });

  it('respects the 1 minute window', () => {
    expect(shouldLock(T, T + 59_999, '1m')).toBe(false);
    expect(shouldLock(T, T + 60_000, '1m')).toBe(true);
  });

  it('respects the 5 minute window', () => {
    expect(shouldLock(T, T + 4 * 60_000, '5m')).toBe(false);
    expect(shouldLock(T, T + 5 * 60_000 + 1, '5m')).toBe(true);
  });
});
