'use client'
import {
 QueryClient,
 QueryClientProvider,
 } from '@tanstack/react-query'
 
 const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
 
 export default function ReactQueryProvider({ children }: { children: React.ReactNode }) {
 return (
 <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
 )
 }
 