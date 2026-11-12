import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import type { ProgramDto } from '@sigoa/shared';
import { programKeys } from './program-keys';
import { useUpdateProgram } from './use-update-program';

const initialProgram: ProgramDto = {
  id: 'cm3programcuid1234567890',
  code: 'EPIS',
  name: 'Escuela Profesional de Ingeniería de Sistemas',
  faculty: 'Facultad de Ingeniería de Sistemas y Mecánica Eléctrica',
  updatedAt: '2026-11-09T12:00:00.000Z',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(programKeys.all, initialProgram);

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('useUpdateProgram mutation hook (T-009-11)', () => {
  it('updates program and sets query data cache on success', async () => {
    const updatedProgram: ProgramDto = {
      ...initialProgram,
      name: 'Ingeniería de Sistemas',
      updatedAt: '2026-11-09T14:00:00.000Z',
    };

    server.use(
      http.patch('http://localhost:3000/program', () => {
        return HttpResponse.json(updatedProgram);
      }),
    );

    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateProgram(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Ingeniería de Sistemas' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(updatedProgram);

    // Cache updated
    const cached = queryClient.getQueryData<ProgramDto>(programKeys.all);
    expect(cached).toEqual(updatedProgram);
  });

  it('handles mutation error correctly', async () => {
    server.use(
      http.patch('http://localhost:3000/program', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Ya existe otro programa con el código especificado',
            },
          },
          { status: 409 },
        );
      }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateProgram(), { wrapper: Wrapper });

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ code: 'DUPLICADO' });
      } catch (err) {
        caughtError = err;
      }
    });

    expect(caughtError).toBeDefined();
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.status).toBe(409);
  });
});
