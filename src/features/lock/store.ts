import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { secureStorage } from '@/lib/secure-storage';
import type { LockTimeout } from './logic';

type LockState = {
  enabled: boolean;
  timeout: LockTimeout;
  setEnabled: (enabled: boolean) => void;
  setLockTimeout: (timeout: LockTimeout) => void;
};

export const useLockSettings = create<LockState>()(
  persist(
    (set) => ({
      enabled: false,
      timeout: '1m',
      setEnabled: (enabled) => set({ enabled }),
      setLockTimeout: (timeout) => set({ timeout }),
    }),
    {
      name: 'kosh.lock',
      storage: createJSONStorage(() => secureStorage),
      partialize: ({ enabled, timeout }) => ({ enabled, timeout }),
    },
  ),
);
