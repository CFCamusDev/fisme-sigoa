import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { server } from '@/test/msw/server';
import { useLogin } from './use-login';

const mockValidResponse = {
  accessToken: 'header.payload.signature',
  accessTokenExpiresAt: '2026-10-30T10:15:00.000Z',
  refreshTokenExpiresAt: '2026-11-06T10:00:00.000Z',
  user: {
    id: 'usr-123',
    names: 'Juan',
    firstSurname: 'Pérez',
    secondSurname: 'García',
    email: 'juan.perez@untrm.edu.pe',
  },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useLogin hook', () => {
  it('executes login mutation successfully', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () => {
        return HttpResponse.json(mockValidResponse, { status: 200 });
      }),
    );

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      email: 'juan.perez@untrm.edu.pe',
      password: 'StrongPassword123',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockValidResponse);
  });
});
