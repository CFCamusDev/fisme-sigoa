import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { useNextTransition } from './use-next-transition';

const SAMPLE_TRANSITION = {
  executionId: 'exec-1',
  status: 'PLANNED',
  nextStatus: 'IN_PROGRESS',
  preconditions: [
    {
      code: 'SCHEDULE_HAS_ACTIVITY',
      label: 'El cronograma tiene al menos una actividad registrada',
      state: 'MET',
    },
  ],
  canAdvance: true,
};

describe('useNextTransition (HU-029, T-029-06)', () => {
  it('loads the next transition', async () => {
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json(SAMPLE_TRANSITION),
      ),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useNextTransition('exec-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(SAMPLE_TRANSITION);
  });

  it('exposes the error', async () => {
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'No encontrado' } },
          { status: 404 },
        ),
      ),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useNextTransition('exec-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(404);
  });
});
