import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 0,
      networkMode: 'offlineFirst',
    },
  },
})

const storage =
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined

export const queryPersister = storage
  ? createSyncStoragePersister({
      storage,
      key: 'binkylabs-react-query',
    })
  : undefined

export function PersistedQueryClientProvider({ children }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 1000 * 60 * 60 * 24,
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === 'success',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}

