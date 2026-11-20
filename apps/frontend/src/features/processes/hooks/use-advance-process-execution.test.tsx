import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { useAdvanceProcessExecution } from './use-advance-process-execution';
import { useNextTransition } from './use-next-transition';
import { useProcessExecutions } from './use-process-executions';

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

const SAMPLE_ADVANCE_RESPONSE = {
  executionId: 'exec-1',
  previousStatus: 'PLANNED',
  status: 'IN_PROGRESS',
  updatedAt: '2027-03-01T10:00:00.000Z',
};

describe('useAdvanceProcessExecution (HU-029, T-029-06)', () => {
  it('invalidates the transition and the executions list on success', async () => {
    let transitionCalls = 0;
    let listCalls = 0;

    server.use(
      http.get('*/process-executions/exec-1/next-transition', () => {
        transitionCalls += 1;
        return HttpResponse.json(SAMPLE_TRANSITION);
      }),
      http.get('*/process-executions', () => {
        listCalls += 1;
        return HttpResponse.json({
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        });
      }),
      http.post('*/process-executions/exec-1/advance', () =>
        HttpResponse.json(SAMPLE_ADVANCE_RESPONSE),
      ),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useNextTransition('exec-1'), { wrapper });
    renderHook(() => useProcessExecutions({ page: 1, pageSize: 20 }), { wrapper });
    await waitFor(() => expect(transitionCalls).toBe(1));
    await waitFor(() => expect(listCalls).toBe(1));

    const { result } = renderHook(() => useAdvanceProcessExecution('exec-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(transitionCalls).toBe(2));
    await waitFor(() => expect(listCalls).toBe(2));
  });

  it('shares one request for simultaneous advances', async () => {
    let postCalls = 0;
    server.use(
      http.post('*/process-executions/exec-1/advance', async () => {
        postCalls += 1;
        await delay(30);
        return HttpResponse.json(SAMPLE_ADVANCE_RESPONSE);
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );

    const { result } = renderHook(() => useAdvanceProcessExecution('exec-1'), { wrapper });

    await act(async () => {
      const [first, second] = await Promise.all([
        result.current.mutateAsync(),
        result.current.mutateAsync(),
      ]);
      expect(first).toEqual(second);
    });

    expect(postCalls).toBe(1);
  });

  it('invalidates the transition on 409', async () => {
    let transitionCalls = 0;
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () => {
        transitionCalls += 1;
        return HttpResponse.json(SAMPLE_TRANSITION);
      }),
      http.post('*/process-executions/exec-1/advance', () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Faltan precondiciones',
              details: [{ path: 'SCHEDULE_HAS_ACTIVITY', message: 'Falta actividad' }],
            },
          },
          { status: 409 },
        ),
      ),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useNextTransition('exec-1'), { wrapper });
    await waitFor(() => expect(transitionCalls).toBe(1));

    const { result } = renderHook(() => useAdvanceProcessExecution('exec-1'), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow();
    });

    await waitFor(() => expect(transitionCalls).toBe(2));
  });
});
