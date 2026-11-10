import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import type { ProgramDto } from '@sigoa/shared';
import { useProgram } from './use-program';

const mockProgram: ProgramDto = {
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
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('useProgram query hook (T-009-11)', () => {
  it('fetches program successfully from server', async () => {
    server.use(
      http.get('http://localhost:3000/program', () => {
        return HttpResponse.json(mockProgram);
      }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProgram(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockProgram);
  });

  it('fails with 404 without retrying', async () => {
    let callCount = 0;
    server.use(
      http.get('http://localhost:3000/program', () => {
        callCount += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'NOT_FOUND',
              message: 'No se encontró el programa',
            },
          },
          { status: 404 },
        );
      }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProgram(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(404);
    expect(callCount).toBe(1);
  });

  it('fails with 403 without retrying', async () => {
    let callCount = 0;
    server.use(
      http.get('http://localhost:3000/program', () => {
        callCount += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'No tienes permiso para consultar el programa',
            },
          },
          { status: 403 },
        );
      }),
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useProgram(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.status).toBe(403);
    expect(callCount).toBe(1);
  });

  it('shares one request between the page and 20 consumers under StrictMode (Concurrency & AGENTS §5)', async () => {
    let requestCount = 0;
    server.use(
      http.get('http://localhost:3000/program', async () => {
        requestCount += 1;
        return HttpResponse.json(mockProgram);
      }),
    );

    const { queryClient } = createWrapper();

    function ProgramConsumer({ index }: { index: number }) {
      const { data } = useProgram();
      return <div data-testid={`consumer-${index}`}>{data ? data.name : 'cargando'}</div>;
    }

    function MultiConsumerPage() {
      return (
        <StrictMode>
          <QueryClientProvider client={queryClient}>
            <div>
              {Array.from({ length: 20 }, (_, i) => (
                <ProgramConsumer key={i} index={i} />
              ))}
            </div>
          </QueryClientProvider>
        </StrictMode>
      );
    }

    render(<MultiConsumerPage />);

    await waitFor(() => {
      expect(screen.getByTestId('consumer-0')).toHaveTextContent(mockProgram.name);
      expect(screen.getByTestId('consumer-19')).toHaveTextContent(mockProgram.name);
    });

    // A pesar de haber 20 consumidores y estar bajo StrictMode (efectos dobles),
    // la promesa en vuelo se comparte y se realiza exactamente 1 sola petición de red
    expect(requestCount).toBe(1);
  });
});
