import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { server } from '@/test/msw/server';
import { useResetPassword } from './use-reset-password';

const validToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const validPassword = 'NewStrongPassword2026*';
const mockSuccessResponse = { status: 'PASSWORD_RESET' };

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

describe('useResetPassword hook (HU-005, T-005-09)', () => {
  it('executes reset password mutation successfully', async () => {
    server.use(
      http.post('http://localhost:3000/auth/reset-password', () => {
        return HttpResponse.json(mockSuccessResponse, { status: 200 });
      }),
    );

    const { result } = renderHook(() => useResetPassword(), {
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
      http.post('http://localhost:3000/auth/reset-password', () => {
        callCount++;
        return HttpResponse.json(
          {
            error: {
              code: 'INVALID_PASSWORD_RESET_TOKEN',
              message: 'El enlace no es válido o venció.',
            },
          },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHook(() => useResetPassword(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({
      token: validToken,
      password: validPassword,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(callCount).toBe(1);
    expect(result.current.error?.code).toBe('INVALID_PASSWORD_RESET_TOKEN');
  });
});
