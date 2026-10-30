import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { secureStorage } from '@/lib/secure-storage';

type ProfileState = {
  name: string;
  onboarded: boolean;
  setName: (name: string) => void;
  finishOnboarding: () => void;
};

/** Persisted under secure-store key 'kosh.profile' as JSON { state: { name, onboarded } }. */
export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      name: '',
      onboarded: false,
      setName: (name) => set({ name: name.trim() }),
      finishOnboarding: () => set({ onboarded: true }),
    }),
    {
      name: 'kosh.profile',
      storage: createJSONStorage(() => secureStorage),
      partialize: ({ name, onboarded }) => ({ name, onboarded }),
    },
  ),
);
