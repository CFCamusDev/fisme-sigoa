import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import type { ListSemestersResponse, SemesterDto } from '@sigoa/shared';
import { useSemesters } from './use-semesters';

const mockSemester: SemesterDto = {
  id: 'cm3semcuid202710000000',
  code: '2027-I',
  startDate: '2027-03-01',
  endDate: '2027-07-31',
  updatedAt: '2026-11-09T10:00:00.000Z',
};

const mockListResponse: ListSemestersResponse = {
  items: [mockSemester],
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

describe('useSemesters query hook (T-010-10, CA1, D6)', () => {
  it('fetches semesters list successfully from server', async () => {
    server.use(
      http.get('http://localhost:3000/semesters', () => {
        return HttpResponse.json(mockListResponse);
      }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useSemesters(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockListResponse);
  });

  it('shares one request between the page and 20 consumers under StrictMode (Concurrency & AGENTS §5)', async () => {
    let requestCount = 0;
    server.use(
      http.get('http://localhost:3000/semesters', async () => {
        requestCount += 1;
        return HttpResponse.json(mockListResponse);
      }),
    );

    const { queryClient } = createWrapper();

    function SemesterConsumer({ index }: { index: number }) {
      const { data } = useSemesters();
      return <div data-testid={`consumer-${index}`}>{data ? data.items[0]?.code : 'cargando'}</div>;
    }

    function MultiConsumerPage() {
      return (
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <div>
              {Array.from({ length: 20 }, (_, i) => (
                <SemesterConsumer key={i} index={i} />
              ))}
            </div>
          </QueryClientProvider>
        </StrictMode>
      );
    }

    render(<MultiConsumerPage />);

    await waitFor(() => {
      expect(screen.getByTestId('consumer-0')).toHaveTextContent(mockSemester.code);
      expect(screen.getByTestId('consumer-19')).toHaveTextContent(mockSemester.code);
    });

    // Exactamente 1 sola petición de red compartida
    expect(requestCount).toBe(1);
  });
});
