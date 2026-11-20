import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw/server';
import { createTestQueryClient } from '@/test/render';
import { useSchedule } from './use-schedule';

const SAMPLE_ACTIVITY = {
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

describe('useSchedule (HU-028, T-028-13)', () => {
  it('loads the schedule', async () => {
    server.use(
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json({ items: [SAMPLE_ACTIVITY] }),
      ),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSchedule('exec-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0]?.id).toBe('act-1');
  });

  it('exposes the error', async () => {
    server.use(
      http.get('*/process-executions/exec-1/schedule', () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Ejecución no encontrada' } },
          { status: 404 },
        ),
      ),
    );

    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSchedule('exec-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(404);
  });
});
