import { render, screen, waitFor } from '@testing-library/react';
import {
  createMemoryHistory,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { queryClient } from '@/lib/query-client';
import { Route as RootRoute } from '@/routes/__root';
import { Route as UsersIndexRoute } from '@/routes/_app/usuarios/index';
import { Route as UsersNewRoute } from '@/routes/_app/usuarios/nuevo';
import { Route as UsersEditRoute } from '@/routes/_app/usuarios/$userId/editar';
import { Route as RolesIndexRoute } from '@/routes/_app/roles/index';
import { Route as RolesNewRoute } from '@/routes/_app/roles/nuevo';
import { Route as RolesEditRoute } from '@/routes/_app/roles/$roleId/editar';
import { Route as RolesPermissionsRoute } from '@/routes/_app/roles/$roleId/permisos';
import { Route as ProgramRoute } from '@/routes/_app/configuracion/programa';
import { useAuthStore } from '@/stores/auth.store';
import { server } from '@/test/msw/server';
import { ForbiddenRouteError, guardPermission } from './permission-guard';

function setupAuthenticatedUser(userId = 'usr-guard-test') {
  useAuthStore.getState().setAuthSession({
    accessToken: 'test-token',
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

function createGuardedTestRouter(initialEntry: string) {
  const indexRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: '/',
    component: () => <div>Panel principal</div>,
  });

  const loginRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: '/login',
    component: () => <div>Página de inicio de sesión</div>,
  });

  const appLayoutRoute = createRoute({
    getParentRoute: () => RootRoute,
    id: '_app',
    component: () => <Outlet />,
  });

  const usersRoute = createRoute({
    getParentRoute: () => appLayoutRoute,
    path: '/usuarios',
    beforeLoad: () => guardPermission('usuario.ver'),
    component: () => <div data-testid="users-content">Contenido secreto de usuarios</div>,
  });

  const routeTree = RootRoute.addChildren([
    indexRoute,
    loginRoute,
    appLayoutRoute.addChildren([usersRoute]),
  ]);

  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
}

describe('guardPermission and ForbiddenRouteError (HU-008, T-008-05)', () => {
  const originalDefaultOptions = queryClient.getDefaultOptions();

  beforeEach(() => {
    queryClient.clear();
    queryClient.setDefaultOptions({
      ...originalDefaultOptions,
      queries: {
        ...originalDefaultOptions.queries,
        retry: false,
      },
    });
    useAuthStore.getState().clearAuthSession();
  });

  afterEach(() => {
    queryClient.clear();
    queryClient.setDefaultOptions(originalDefaultOptions);
    useAuthStore.getState().clearAuthSession();
  });

  it('redirects to /login when there is no authenticated user', async () => {
    const router = createGuardedTestRouter('/usuarios');
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Página de inicio de sesión')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByTestId('users-content')).not.toBeInTheDocument();
  });

  it('renders the protected route when the user has the required permission', async () => {
    setupAuthenticatedUser('usr-admin');
    server.use(
      http.get('http://localhost:3000/me/permissions', () =>
        HttpResponse.json({
          permissions: [{ code: 'usuario.ver', scope: 'GLOBAL' }],
        }),
      ),
    );

    const router = createGuardedTestRouter('/usuarios');
    render(<RouterProvider router={router} />);

    expect(await screen.findByTestId('users-content')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/usuarios');
  });

  it('renders ForbiddenPage with region role, moves focus to the heading and keeps the URL when permission is missing', async () => {
    setupAuthenticatedUser('usr-teacher');
    server.use(
      http.get('http://localhost:3000/me/permissions', () =>
        HttpResponse.json({
          permissions: [{ code: 'medicion_directa.registrar', scope: 'OWN' }],
        }),
      ),
    );

    const router = createGuardedTestRouter('/usuarios');
    render(<RouterProvider router={router} />);

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'No tienes acceso a esta sección',
    });
    expect(heading).toBeInTheDocument();

    const region = screen.getByRole('region', { name: 'No tienes acceso a esta sección' });
    expect(region).toBeInTheDocument();

    await waitFor(() => {
      expect(heading).toHaveFocus();
    });

    expect(router.state.location.pathname).toBe('/usuarios');
    expect(screen.queryByTestId('users-content')).not.toBeInTheDocument();
  });

  it('does not render the page when permissions fail to load', async () => {
    setupAuthenticatedUser('usr-net-fail');
    server.use(
      http.get('http://localhost:3000/me/permissions', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Fallo de servidor' } },
          { status: 500 },
        ),
      ),
    );

    const router = createGuardedTestRouter('/usuarios');
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Algo salió mal' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('users-content')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/usuarios');
  });

  it('exposes permission and scope on ForbiddenRouteError instances', () => {
    const err = new ForbiddenRouteError('rol.editar', 'GLOBAL');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ForbiddenRouteError');
    expect(err.permission).toBe('rol.editar');
    expect(err.scope).toBe('GLOBAL');
  });

  it('wires beforeLoad permission guards on all protected user and role routes', async () => {
    setupAuthenticatedUser('usr-teacher-routes');
    server.use(
      http.get('http://localhost:3000/me/permissions', () =>
        HttpResponse.json({
          permissions: [],
        }),
      ),
    );

    const expectedGuards: Array<{
      route: { options: { beforeLoad?: (...args: never[]) => unknown } };
      permission: string;
    }> = [
      { route: UsersIndexRoute, permission: 'usuario.ver' },
      { route: UsersNewRoute, permission: 'usuario.crear' },
      { route: UsersEditRoute, permission: 'usuario.editar' },
      { route: RolesIndexRoute, permission: 'rol.ver' },
      { route: RolesNewRoute, permission: 'rol.editar' },
      { route: RolesEditRoute, permission: 'rol.editar' },
      { route: RolesPermissionsRoute, permission: 'rol.editar' },
      { route: ProgramRoute, permission: 'parametro.ver' },
    ];

    for (const { route, permission } of expectedGuards) {
      expect(typeof route.options.beforeLoad).toBe('function');
      await expect(route.options.beforeLoad!()).rejects.toMatchObject({
        name: 'ForbiddenRouteError',
        permission,
        scope: 'GLOBAL',
      });
    }
  });
});
