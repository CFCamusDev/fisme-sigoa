import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { useCloseProcessExecution } from './use-close-process-execution';
import { useExecutionBoard } from './use-execution-board';
import { useNextTransition } from './use-next-transition';
import { useProcessExecutions } from './use-process-executions';

const SAMPLE_TRANSITION = {
  executionId: 'exec-1',
  status: 'PENDING_APPROVAL',
  nextStatus: null,
  preconditions: [],
  canAdvance: false,
};

const SAMPLE_CLOSE_RESPONSE = {
  executionId: 'exec-1',
  previousStatus: 'PENDING_APPROVAL',
  status: 'CLOSED',
  updatedAt: '2027-03-01T10:00:00.000Z',
};

describe('useCloseProcessExecution (HU-030, T-030-08)', () => {
  it('invalidates the transition, the list and the board on success', async () => {
    let transitionCalls = 0;
    let listCalls = 0;
    let boardCalls = 0;

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
      http.get('*/process-executions/exec-1/board', () => {
        boardCalls += 1;
        return HttpResponse.json({
          execution: {
            id: 'exec-1',
            programId: 'prog-1',
            type: 'P611',
            name: 'Establecer OE 2027',
            year: 2027,
            semesterId: null,
            semesterCode: null,
            catalogVersionId: 'cv-1',
            catalogVersionNumber: 1,
            status: 'PENDING_APPROVAL',
            voidReason: null,
            createdBy: 'user-1',
            updatedBy: null,
            createdAt: '2027-01-10T10:00:00.000Z',
            updatedAt: '2027-01-10T10:00:00.000Z',
          },
          steps: [],
          scheduleSummary: {
            total: 0,
            completed: 0,
            inProgress: 0,
            pending: 0,
            overdue: 0,
            progressPercent: 0,
          },
          sessionsSummary: {
            total: 0,
            lastSessionDate: null,
            items: [],
          },
          pendingItems: [],
          nextTransition: SAMPLE_TRANSITION,
        });
      }),
      http.post('*/process-executions/exec-1/close', () =>
        HttpResponse.json(SAMPLE_CLOSE_RESPONSE),
      ),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useNextTransition('exec-1'), { wrapper });
    renderHook(() => useProcessExecutions({ page: 1, pageSize: 20 }), { wrapper });
    renderHook(() => useExecutionBoard('exec-1'), { wrapper });
    await waitFor(() => expect(transitionCalls).toBe(1));
    await waitFor(() => expect(listCalls).toBe(1));
    await waitFor(() => expect(boardCalls).toBe(1));

    const { result } = renderHook(() => useCloseProcessExecution('exec-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    await waitFor(() => expect(transitionCalls).toBe(2));
    await waitFor(() => expect(listCalls).toBe(2));
    await waitFor(() => expect(boardCalls).toBe(2));
  });

  it('invalidates the transition on 409 and exposes the error', async () => {
    let transitionCalls = 0;
    server.use(
      http.get('*/process-executions/exec-1/next-transition', () => {
        transitionCalls += 1;
        return HttpResponse.json(SAMPLE_TRANSITION);
      }),
      http.post('*/process-executions/exec-1/close', () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Falta resolución aprobada',
              details: [{ path: 'RESOLUTION_APPROVED', message: 'Falta resolución' }],
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

    const { result } = renderHook(() => useCloseProcessExecution('exec-1'), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow('Falta resolución aprobada');
    });

    await waitFor(() => expect(transitionCalls).toBe(2));
    expect(result.current.error?.status).toBe(409);
  });

  it('sends a single request for concurrent mutations', async () => {
    let postCalls = 0;
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });

    server.use(
      http.post('*/process-executions/exec-1/close', async () => {
        postCalls += 1;
        await gate;
        return HttpResponse.json(SAMPLE_CLOSE_RESPONSE);
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );

    const { result } = renderHook(() => useCloseProcessExecution('exec-1'), { wrapper });

    await act(async () => {
      const pending = Promise.all([result.current.mutateAsync(), result.current.mutateAsync()]);
      releaseGate();
      const [first, second] = await pending;
      expect(first).toEqual(second);
    });

    expect(postCalls).toBe(1);
  });
});
