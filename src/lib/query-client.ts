import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

/** Shared query keys. Each feature adds its own keys under its domain prefix. */
export const qk = {
  accounts: ['accounts'] as const,
  categories: ['categories'] as const,
  transactions: (filter?: object) => ['transactions', filter ?? {}] as const,
  holdings: ['holdings'] as const,
  subscriptions: ['subscriptions'] as const,
  dues: ['dues'] as const,
  summary: ['summary'] as const,
};
