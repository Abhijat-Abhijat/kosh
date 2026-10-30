import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { device, deviceCapabilities } from '@/lib/device';

type UsageAccess = 'unknown' | 'unsupported' | 'granted' | 'denied';

const query = () => device.hasUsageAccess().catch(() => false);

/**
 * Usage-access state: 'unsupported' (no native module: iOS, web, Expo Go), 'granted' or 'denied'.
 * Re-checks when the app returns to the foreground (e.g. back from the settings screen).
 */
export function useUsageAccess() {
  const [state, setState] = useState<UsageAccess>(deviceCapabilities.available ? 'unknown' : 'unsupported');
  const recheck = useCallback(() => {
    if (deviceCapabilities.available) query().then((ok) => setState(ok ? 'granted' : 'denied'));
  }, []);
  useEffect(() => {
    if (!deviceCapabilities.available) return;
    query().then((ok) => setState(ok ? 'granted' : 'denied'));
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') query().then((ok) => setState(ok ? 'granted' : 'denied'));
    });
    return () => sub.remove();
  }, []);
  return { state, openSettings: () => device.openUsageAccessSettings(), recheck };
}
