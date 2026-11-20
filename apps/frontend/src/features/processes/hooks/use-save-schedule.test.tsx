import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { scheduleKeys } from './schedule-keys';
import { useSaveSchedule } from './use-save-schedule';

const SAMPLE_RESPONSE = {
  items: [
    {
      id: 'act-1',
      processExecutionId: 'exec-1',
      number: 1,
      activity: 'Actividad guardada',
      responsible: 'Presidente',
      goal: null,
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

describe('useSaveSchedule (HU-028, T-028-13)', () => {
  it('updates the cache', async () => {
    server.use(
      http.put('*/process-executions/exec-1/schedule', () => HttpResponse.json(SAMPLE_RESPONSE)),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSaveSchedule('exec-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        activities: [{ activity: 'Actividad guardada', responsible: 'Presidente' }],
      });
    });

    expect(queryClient.getQueryData(scheduleKeys.detail('exec-1'))).toEqual(SAMPLE_RESPONSE);
  });

  it('shares one request for the same body', async () => {
    let putCalls = 0;
    server.use(
      http.put('*/process-executions/exec-1/schedule', async () => {
        putCalls += 1;
        await delay(30);
        return HttpResponse.json(SAMPLE_RESPONSE);
      }),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </StrictMode>
    );

    const { result } = renderHook(() => useSaveSchedule('exec-1'), { wrapper });
    const payload = {
      activities: [{ activity: 'Actividad guardada', responsible: 'Presidente' }],
    };

    await act(async () => {
      const [first, second] = await Promise.all([
        result.current.mutateAsync(payload),
        result.current.mutateAsync(payload),
      ]);
      expect(first).toEqual(second);
    });

    expect(putCalls).toBe(1);
  });
});
