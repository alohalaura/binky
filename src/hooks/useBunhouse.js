import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useBunhouse = create(
  persist(
    (set) => ({
      activeBunhouseId: null,
      setActiveBunhouseId: (activeBunhouseId) => set({ activeBunhouseId }),
      clearActiveBunhouse: () => set({ activeBunhouseId: null }),
    }),
    { name: 'binkylabs-active-bunhouse' },
  ),
)

