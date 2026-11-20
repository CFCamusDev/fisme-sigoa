import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { scheduleKeys } from './schedule-keys';
import { useChangeScheduleActivityStatus } from './use-change-schedule-activity-status';
import { useSchedule } from './use-schedule';

const BASE_ACTIVITY = {
  id: 'act-1',
  processExecutionId: 'exec-1',
  number: 1,
  activity: 'Elaborar cronograma',
  responsible: 'Presidente',
  goal: 'Anexo 1',
  indicator: null,
  startDate: '2027-03-01',
  endDate: '2027-03-15',
  status: 'PENDING',
  actualEndDate: null,
  isOverdue: false,
  createdAt: '2027-03-01T10:00:00.000Z',
  updatedAt: '2027-03-01T10:00:00.000Z',
};

const IN_PROGRESS_ACTIVITY = {
  ...BASE_ACTIVITY,
  status: 'IN_PROGRESS',
  updatedAt: '2027-03-02T10:00:00.000Z',
};

describe('useChangeScheduleActivityStatus (HU-028, T-028-13)', () => {
  it('updates the cache', async () => {
    server.use(
      http.patch('*/schedule-activities/act-1/status', () =>
        HttpResponse.json(IN_PROGRESS_ACTIVITY),
      ),
    );

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(scheduleKeys.detail('exec-1'), { items: [BASE_ACTIVITY] });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useChangeScheduleActivityStatus('exec-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        activityId: 'act-1',
        body: { status: 'IN_PROGRESS' },
      });
    });

    expect(queryClient.getQueryData(scheduleKeys.detail('exec-1'))).toEqual({
      items: [IN_PROGRESS_ACTIVITY],
    });
  });

  it('shares one request for simultaneous status changes', async () => {
    let patchCalls = 0;
    server.use(
      http.patch('*/schedule-activities/act-1/status', async () => {
        patchCalls += 1;
        await delay(30);
        return HttpResponse.json(IN_PROGRESS_ACTIVITY);
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );

    const { result } = renderHook(() => useChangeScheduleActivityStatus('exec-1'), { wrapper });

    await act(async () => {
      const [first, second] = await Promise.all([
        result.current.mutateAsync({ activityId: 'act-1', body: { status: 'IN_PROGRESS' } }),
        result.current.mutateAsync({ activityId: 'act-1', body: { status: 'IN_PROGRESS' } }),
      ]);
      expect(first).toEqual(second);
    });

    expect(patchCalls).toBe(1);
  });

  it('invalidates on 404 and 409', async () => {
    let getCalls = 0;
    let statusToReturn = 404;

    server.use(
      http.get('*/process-executions/exec-1/schedule', () => {
        getCalls += 1;
        return HttpResponse.json({ items: [BASE_ACTIVITY] });
      }),
      http.patch('*/schedule-activities/act-1/status', () =>
        HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Error de estado' } },
          { status: statusToReturn },
        ),
      ),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useSchedule('exec-1'), { wrapper });
    await waitFor(() => expect(getCalls).toBe(1));

    const { result } = renderHook(() => useChangeScheduleActivityStatus('exec-1'), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ activityId: 'act-1', body: { status: 'IN_PROGRESS' } }),
      ).rejects.toThrow();
    });
    await waitFor(() => expect(getCalls).toBe(2));

    statusToReturn = 409;
    await act(async () => {
      await expect(
        result.current.mutateAsync({ activityId: 'act-1', body: { status: 'IN_PROGRESS' } }),
      ).rejects.toThrow();
    });
    await waitFor(() => expect(getCalls).toBe(3));
  });
});
