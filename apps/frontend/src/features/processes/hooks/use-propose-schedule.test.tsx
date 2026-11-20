import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { scheduleKeys } from './schedule-keys';
import { useProposeSchedule } from './use-propose-schedule';
import { useSchedule } from './use-schedule';

const SAMPLE_RESPONSE = {
  items: [
    {
      id: 'act-1',
      processExecutionId: 'exec-1',
      number: 1,
      activity: 'Elaborar cronograma',
      responsible: 'Presidente',
      goal: 'Anexo 1',
      indicator: null,
      startDate: null,
      endDate: null,
      status: 'PENDING',
      actualEndDate: null,
      isOverdue: false,
      createdAt: '2027-03-01T10:00:00.000Z',
      updatedAt: '2027-03-01T10:00:00.000Z',
    },
  ],
};

describe('useProposeSchedule (HU-028, T-028-13)', () => {
  it('updates the cache with the response', async () => {
    server.use(
      http.post('*/process-executions/exec-1/schedule/propose', () =>
        HttpResponse.json(SAMPLE_RESPONSE, { status: 201 }),
      ),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useProposeSchedule('exec-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(queryClient.getQueryData(scheduleKeys.detail('exec-1'))).toEqual(SAMPLE_RESPONSE);
  });

  it('shares one request for simultaneous proposals', async () => {
    let postCalls = 0;
    server.use(
      http.post('*/process-executions/exec-1/schedule/propose', async () => {
        postCalls += 1;
        await delay(30);
        return HttpResponse.json(SAMPLE_RESPONSE, { status: 201 });
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );

    const { result } = renderHook(() => useProposeSchedule('exec-1'), { wrapper });

    await act(async () => {
      const [first, second] = await Promise.all([
        result.current.mutateAsync(),
        result.current.mutateAsync(),
      ]);
      expect(first).toEqual(second);
    });

    expect(postCalls).toBe(1);
  });

  it('invalidates on 409', async () => {
    let getCalls = 0;
    server.use(
      http.get('*/process-executions/exec-1/schedule', () => {
        getCalls += 1;
        return HttpResponse.json({ items: [] });
      }),
      http.post('*/process-executions/exec-1/schedule/propose', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'El cronograma ya existe' } },
          { status: 409 },
        ),
      ),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useSchedule('exec-1'), { wrapper });
    await waitFor(() => expect(getCalls).toBe(1));

    const { result } = renderHook(() => useProposeSchedule('exec-1'), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow();
    });

    await waitFor(() => expect(getCalls).toBe(2));
  });
});
