import { StrictMode, type ReactNode } from 'react';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { useAuthStore } from '@/stores/auth.store';
import { permissionsQueryOptions } from '@/features/authorization';
import { usePermission } from './use-permission';

function setSessionForUser(userId = 'usr-1') {
  useAuthStore.getState().setAuthSession({
    accessToken: 'valid-token',
    accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    user: {
      id: userId,
      names: 'Docente',
      firstSurname: 'Prueba',
      secondSurname: null,
      email: 'docente@untrm.edu.pe',
    },
  });
}

function createWrapper(
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  }),
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('usePermission hook (HU-008, T-008-04, CA3, D7, D8)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
  });

  it('fails closed with allowed=false and isLoading=false when no user is authenticated', () => {
    const { result } = renderHook(() => usePermission('usuario.ver'), {
      wrapper: createWrapper(),
    });

    expect(result.current).toEqual({
      allowed: false,
      isLoading: false,
    });
  });

  it('fails closed while loading and resolves allowed=true when GLOBAL grant matches GLOBAL requirement', async () => {
    setSessionForUser('usr-admin');
    server.use(
      http.get('http://localhost:3000/me/permissions', async () => {
        await delay(20);
        return HttpResponse.json(
          {
            permissions: [{ code: 'usuario.ver', scope: 'GLOBAL' }],
          },
          { status: 200 },
        );
      }),
    );

    const { result } = renderHook(() => usePermission('usuario.ver', 'GLOBAL'), {
      wrapper: createWrapper(),
    });

    expect(result.current.allowed).toBe(false);
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.allowed).toBe(true);
  });

  it('enforces scope hierarchy: GLOBAL covers OWN, OWN covers OWN, but OWN does not cover GLOBAL', async () => {
    setSessionForUser('usr-teacher');
    server.use(
      http.get('http://localhost:3000/me/permissions', () => {
        return HttpResponse.json(
          {
            permissions: [
              { code: 'medicion.ver', scope: 'OWN' },
              { code: 'catalogo.ver', scope: 'GLOBAL' },
            ],
          },
          { status: 200 },
        );
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = createWrapper(queryClient);

    const { result: ownOnOwn } = renderHook(() => usePermission('medicion.ver', 'OWN'), {
      wrapper,
    });
    const { result: ownOnGlobal } = renderHook(() => usePermission('medicion.ver', 'GLOBAL'), {
      wrapper,
    });
    const { result: globalOnOwn } = renderHook(() => usePermission('catalogo.ver', 'OWN'), {
      wrapper,
    });
    const { result: missingPerm } = renderHook(() => usePermission('usuario.ver', 'GLOBAL'), {
      wrapper,
    });

    await waitFor(() => {
      expect(ownOnOwn.current.isLoading).toBe(false);
    });

    expect(ownOnOwn.current.allowed).toBe(true);
    expect(ownOnGlobal.current.allowed).toBe(false);
    expect(globalOnOwn.current.allowed).toBe(true);
    expect(missingPerm.current.allowed).toBe(false);
  });

  it('fails closed with allowed=false when GET /me/permissions fails', async () => {
    setSessionForUser('usr-err');
    server.use(
      http.get('http://localhost:3000/me/permissions', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Error interno',
            },
          },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => usePermission('usuario.ver'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.allowed).toBe(false);
  });

  it('shares one request between 20 consumers and a route guard under StrictMode', async () => {
    setSessionForUser('usr-concurrent');
    let requestCount = 0;

    server.use(
      http.get('http://localhost:3000/me/permissions', async () => {
        requestCount += 1;
        await delay(30);
        return HttpResponse.json(
          {
            permissions: [
              { code: 'usuario.ver', scope: 'GLOBAL' },
              { code: 'rol.ver', scope: 'GLOBAL' },
            ],
          },
          { status: 200 },
        );
      }),
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    function Consumer({ index }: { index: number }) {
      const { allowed, isLoading } = usePermission(index % 2 === 0 ? 'usuario.ver' : 'rol.ver');
      if (isLoading) {
        return <span data-testid={`consumer-${index}`}>loading</span>;
      }
      return <span data-testid={`consumer-${index}`}>{allowed ? 'allowed' : 'denied'}</span>;
    }

    // Disparamos la guarda de ruta (ensureQueryData) en simultáneo con el montaje de 20 consumidores bajo StrictMode
    const guardPromise = queryClient.ensureQueryData(permissionsQueryOptions('usr-concurrent'));

    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <div>
            {Array.from({ length: 20 }, (_, i) => (
              <Consumer key={i} index={i} />
            ))}
          </div>
        </QueryClientProvider>
      </StrictMode>,
    );

    await guardPromise;

    await waitFor(() => {
      for (let i = 0; i < 20; i += 1) {
        expect(screen.getByTestId(`consumer-${i}`)).toHaveTextContent('allowed');
      }
    });

    expect(requestCount).toBe(1);
  });
});
