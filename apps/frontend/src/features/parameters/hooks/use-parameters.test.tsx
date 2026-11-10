import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { buildParametersResponse } from '@/test/parameter-fixtures';
import { parameterKeys } from './parameter-keys';
import { useParameters } from './use-parameters';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

describe('useParameters query hook (T-011-12, CA1)', () => {
  it('fetches the effective parameters and caches them under the current key', async () => {
    server.use(
      http.get('http://localhost:3000/parameters', () =>
        HttpResponse.json(buildParametersResponse()),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useParameters(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(7);
    expect(queryClient.getQueryData(parameterKeys.list())).toBeDefined();
  });

  it('uses a different key per semester', async () => {
    const requested: (string | null)[] = [];
    server.use(
      http.get('http://localhost:3000/parameters', ({ request }) => {
        requested.push(new URL(request.url).searchParams.get('semesterCode'));
        return HttpResponse.json(buildParametersResponse('2027-I'));
      }),
    );
    const { queryClient, Wrapper } = createWrapper();

    const { result } = renderHook(() => useParameters('2027-I'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requested).toEqual(['2027-I']);
    expect(queryClient.getQueryData(parameterKeys.list('2027-I'))).toBeDefined();
    expect(queryClient.getQueryData(parameterKeys.list())).toBeUndefined();
  });

  it('exposes the error without retrying on 403', async () => {
    let calls = 0;
    server.use(
      http.get('http://localhost:3000/parameters', () => {
        calls += 1;
        return HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Sin permiso' } },
          { status: 403 },
        );
      }),
    );
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useParameters(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(calls).toBe(1);
  });

  it('sends one request when mounted twice under StrictMode', async () => {
    let calls = 0;
    server.use(
      http.get('http://localhost:3000/parameters', async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return HttpResponse.json(buildParametersResponse());
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    function Probe() {
      const { data } = useParameters();
      return <p>{data ? `items:${data.items.length}` : 'loading'}</p>;
    }

    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>
      </StrictMode>,
    );

    expect(await screen.findByText('items:7')).toBeInTheDocument();
    expect(calls).toBe(1);
  });
});
