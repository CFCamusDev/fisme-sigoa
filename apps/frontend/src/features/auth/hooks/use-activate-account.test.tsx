import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { server } from '@/test/msw/server';
import { useActivateAccount } from './use-activate-account';

const validToken = 'd7a4f9b2c3e1456789abcdef0123456789abcdef0123456789abcdef01234567';
const validPassword = 'Password123*';
const mockSuccessResponse = { status: 'ACTIVE' };

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

describe('useActivateAccount hook (HU-004, T-004-09)', () => {
  it('executes activation mutation successfully', async () => {
    server.use(
      http.post('http://localhost:3000/auth/activate', () => {
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    const { result } = renderHook(() => useActivateAccount(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      token: validToken,
      password: validPassword,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSuccessResponse);
  });

  it('handles error without automatic retries (retry: false)', async () => {
    let callCount = 0;
    server.use(
      http.post('http://localhost:3000/auth/activate', () => {
        callCount++;
        return HttpResponse.json(
          {
            error: {
              code: 'INVALID_ACTIVATION_TOKEN',
              message: 'El enlace no es válido o venció.',
            },
          },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHook(() => useActivateAccount(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      token: validToken,
      password: validPassword,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(callCount).toBe(1);
    expect(result.current.error?.code).toBe('INVALID_ACTIVATION_TOKEN');
  });
});
