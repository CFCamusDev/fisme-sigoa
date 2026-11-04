import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { useAuthStore, selectIsAuthenticated } from '@/stores/auth.store';
import { useLogout } from './use-logout';

function createTestSetup(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const rootRoute = createRootRoute({
    component: () => (
      <div>
        <Outlet />
      </div>
    ),
  });

  function LogoutConsumer() {
    const { mutate, isPending } = useLogout();
    return (
      <button onClick={() => mutate()} disabled={isPending}>
        {isPending ? 'Cerrando...' : 'Cerrar'}
      </button>
    );
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <div>
        <h1>Dashboard</h1>
        <LogoutConsumer />
      </div>
    ),
  });

  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: () => <h1>Login Page</h1>,
  });

  const routeTree = rootRoute.addChildren([indexRoute, loginRoute]);
  const history = createMemoryHistory({ initialEntries: [initialPath] });
  const router = createRouter({ routeTree, history });

  function Wrapper() {
    return (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
  }

  return { queryClient, history, Wrapper };
}

describe('useLogout hook (T-002-09, CA2)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
  });

  it('calls the logout endpoint, clears the session, empties query cache and navigates to login', async () => {
    let apiCalled = false;
    server.use(
      http.post('http://localhost:3000/auth/logout', () => {
        apiCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    useAuthStore.getState().setAuthSession({
      accessToken: 'valid.token',
      accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      user: {
        id: 'usr_1',
        names: 'Test',
        firstSurname: 'User',
        secondSurname: null,
        email: 'test@example.com',
      },
    });

    const { queryClient, history, Wrapper } = createTestSetup('/');
    queryClient.setQueryData(['cached-data'], { secret: 'do-not-leak' });

    render(<Wrapper />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(true);

    const button = await screen.findByRole('button', { name: 'Cerrar' });
    await act(async () => {
      button.click();
    });

    await waitFor(() => {
      expect(history.location.pathname).toBe('/login');
    });

    expect(apiCalled).toBe(true);
    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(queryClient.getQueryData(['cached-data'])).toBeUndefined();
  });

  it('clears the session, empties the query cache and goes to login even when the api fails', async () => {
    server.use(
      http.post('http://localhost:3000/auth/logout', () => {
        return HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Servidor no disponible' } },
          { status: 500 },
        );
      }),
    );

    useAuthStore.getState().setAuthSession({
      accessToken: 'valid.token',
      accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 86400000).toISOString(),
      user: {
        id: 'usr_2',
        names: 'Test',
        firstSurname: 'User',
        secondSurname: null,
        email: 'test2@example.com',
      },
    });

    const { queryClient, history, Wrapper } = createTestSetup('/');
    queryClient.setQueryData(['other-cache'], { data: 123 });

    render(<Wrapper />);

    const button = await screen.findByRole('button', { name: 'Cerrar' });
    await act(async () => {
      button.click();
    });

    await waitFor(() => {
      expect(history.location.pathname).toBe('/login');
    });

    expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(queryClient.getQueryData(['other-cache'])).toBeUndefined();
  });
});
