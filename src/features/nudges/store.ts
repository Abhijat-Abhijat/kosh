import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { secureStorage } from '@/lib/secure-storage';

type NudgeState = { enabled: boolean; setEnabled: (enabled: boolean) => void };

export const useNudgeSettings = create<NudgeState>()(
  persist((set) => ({ enabled: true, setEnabled: (enabled) => set({ enabled }) }), {
    name: 'kosh.nudges',
    storage: createJSONStorage(() => secureStorage),
    partialize: ({ enabled }) => ({ enabled }),
  }),
);
