import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../utils/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Don't retry auth/permission/validation failures - only flaky network or 5xx
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
});
