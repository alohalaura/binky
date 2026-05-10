import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useBunny = create(
  persist(
    (set) => ({
      activeBunnyId: null,
      setActiveBunnyId: (activeBunnyId) => set({ activeBunnyId }),
      clearActiveBunny: () => set({ activeBunnyId: null }),
    }),
    { name: 'binkylabs-active-bunny' },
  ),
)

