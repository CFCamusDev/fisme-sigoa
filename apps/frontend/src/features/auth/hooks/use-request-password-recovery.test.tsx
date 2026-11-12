import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { server } from '@/test/msw/server';
import { useRequestPasswordRecovery } from './use-request-password-recovery';

const validEmail = 'carlos.docente@untrm.edu.pe';
const mockSuccessResponse = { status: 'RECEIVED' };

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

describe('useRequestPasswordRecovery hook (HU-005, T-005-09)', () => {
  it('executes password recovery mutation successfully', async () => {
    server.use(
      http.post('http://localhost:3000/auth/forgot-password', () => {
        return HttpResponse.json(mockSuccessResponse, { status: 202 });
      }),
    );

    const { result } = renderHook(() => useRequestPasswordRecovery(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ email: validEmail });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSuccessResponse);
  });

  it('handles error without automatic retries (retry: false)', async () => {
    let callCount = 0;
    server.use(
      http.post('http://localhost:3000/auth/forgot-password', () => {
        callCount++;
        return HttpResponse.json(
          {
            error: {
              code: 'RATE_LIMITED',
              message: 'Has excedido el límite de solicitudes.',
            },
          },
          { status: 429 },
        );
      }),
    );

    const { result } = renderHook(() => useRequestPasswordRecovery(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ email: validEmail });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(callCount).toBe(1);
    expect(result.current.error?.code).toBe('RATE_LIMITED');
  });
});
