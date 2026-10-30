export type LockTimeout = 'immediate' | '1m' | '5m';

const TIMEOUT_MS: Record<LockTimeout, number> = { immediate: 0, '1m': 60_000, '5m': 300_000 };

export const TIMEOUT_OPTIONS: { value: LockTimeout; label: string }[] = [
  { value: 'immediate', label: 'Immediately' },
  { value: '1m', label: 'After 1 min' },
  { value: '5m', label: 'After 5 min' },
];

/** True when the app has been in the background at least as long as the timeout. */
export function shouldLock(lastBackgroundAt: number | null, now: number, timeout: LockTimeout) {
  if (lastBackgroundAt == null) return false;
  return now - lastBackgroundAt >= TIMEOUT_MS[timeout];
}
