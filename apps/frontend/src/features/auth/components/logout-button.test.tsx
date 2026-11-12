import { beforeEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import { render } from '@testing-library/react';
import { server } from '@/test/msw/server';
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth.store';
import { LogoutButton } from './logout-button';

const mockAuthenticatedUser = {
  id: 'usr_abc',
  names: 'Ana María',
  firstSurname: 'Torres',
  secondSurname: 'Vega',
  email: 'ana.torres@untrm.edu.pe',
};

function renderLogoutButtonWithRouter() {
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

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <div>
        <LogoutButton />
      </div>
    ),
  });

  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: () => <div>Login Page Destination</div>,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, loginRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { ...utils, router, queryClient };
}

describe('LogoutButton component (T-002-11, T-002-17, CA2)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
  });

  it('renders nothing when the user is not authenticated', async () => {
    renderLogoutButtonWithRouter();

    // Esperar que el router monte
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /cerrar sesión/i })).not.toBeInTheDocument();
    });
  });

  it('renders user details and the accessible logout button when authenticated', async () => {
    useAuthStore.getState().setAuthSession({
      accessToken: 'valid-token',
      accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 120_000).toISOString(),
      user: mockAuthenticatedUser,
    });

    renderLogoutButtonWithRouter();

    const button = await screen.findByRole('button', { name: /cerrar sesión/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText(/Ana María Torres/i)).toBeInTheDocument();
  });

  it('triggers logout on click, shows loading state, and clears auth store on completion', async () => {
    const user = userEvent.setup();
    let logoutCalled = false;
    let resolveLogout!: () => void;
    const logoutPromise = new Promise<void>((resolve) => {
      resolveLogout = resolve;
    });

    server.use(
      http.post('http://localhost:3000/auth/logout', async () => {
        logoutCalled = true;
        await logoutPromise;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    useAuthStore.getState().setAuthSession({
      accessToken: 'valid-token',
      accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 120_000).toISOString(),
      user: mockAuthenticatedUser,
    });

    renderLogoutButtonWithRouter();

    const button = await screen.findByRole('button', { name: /cerrar sesión/i });
    await user.click(button);

    // Estado pendiente
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: /cerrando sesión/i })).toBeInTheDocument();

    resolveLogout();

    await waitFor(() => {
      expect(logoutCalled).toBe(true);
      expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(screen.getByText(/Login Page Destination/i)).toBeInTheDocument();
    });
  });

  it('can be focused and activated via keyboard (Enter key)', async () => {
    const user = userEvent.setup();
    let logoutCalled = false;

    server.use(
      http.post('http://localhost:3000/auth/logout', () => {
        logoutCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    useAuthStore.getState().setAuthSession({
      accessToken: 'valid-token',
      accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 120_000).toISOString(),
      user: mockAuthenticatedUser,
    });

    renderLogoutButtonWithRouter();

    const button = await screen.findByRole('button', { name: /cerrar sesión/i });
    button.focus();
    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(logoutCalled).toBe(true);
      expect(selectIsAuthenticated(useAuthStore.getState())).toBe(false);
      expect(screen.getByText(/Login Page Destination/i)).toBeInTheDocument();
    });
  });
});
