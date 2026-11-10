import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import type { SemesterDto } from '@sigoa/shared';
import { semesterKeys } from './semester-keys';
import { useCreateSemester } from './use-create-semester';

const mockSemester: SemesterDto = {
  id: 'cm3semcuid202710000000',
  code: '2027-I',
  startDate: '2027-03-01',
  endDate: '2027-07-31',
  updatedAt: '2026-11-09T10:00:00.000Z',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('useCreateSemester mutation hook (T-010-10, CA1, D3)', () => {
  it('creates semester and invalidates semesters query on success (D3)', async () => {
    server.use(
      http.post('http://localhost:3000/semesters', () => {
        return HttpResponse.json(mockSemester, { status: 201 });
      }),
    );

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateSemester(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        code: '2027-I',
        startDate: '2027-03-01',
        endDate: '2027-07-31',
      });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockSemester);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: semesterKeys.all });
  });

  it('handles 409 conflict errors without retry', async () => {
    let callCount = 0;
    server.use(
      http.post('http://localhost:3000/semesters', () => {
        callCount += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'El rango de fechas se superpone con otro semestre',
            },
          },
          { status: 409 },
        );
      }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateSemester(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          code: '2027-I',
          startDate: '2027-03-01',
          endDate: '2027-07-31',
        });
      } catch {
        // expected error
      }
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(409);
    expect(callCount).toBe(1);
  });
});
