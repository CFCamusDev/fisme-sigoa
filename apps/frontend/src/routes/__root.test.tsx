import { act, render, screen } from '@testing-library/react';
import {
  createMemoryHistory,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { Route as rootRoute } from './__root';
import { ApiError } from '@/lib/api-error';

describe('Root route error boundary integration', () => {
  it('renders NotFoundPage when navigating to an unmapped path', async () => {
    const history = createMemoryHistory({ initialEntries: ['/ruta-inexistente'] });
    const router = createRouter({
      routeTree: rootRoute,
      history,
    });

    await act(async () => {
      render(<RouterProvider router={router} />);
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página no encontrada' }),
    ).toBeInTheDocument();
    expect(screen.getByText('La ruta solicitada no existe o ha sido movida.')).toBeInTheDocument();
  });

  it('renders ForbiddenPage when route throws ApiError with status 403', async () => {
    const forbiddenRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/forbidden-test',
      loader: () => {
        throw new ApiError({
          code: 'FORBIDDEN',
          message: 'Acceso no autorizado',
          status: 403,
        });
      },
      component: () => <div>Protected content</div>,
    });

    const routeTree = rootRoute.addChildren([forbiddenRoute]);
    const history = createMemoryHistory({ initialEntries: ['/forbidden-test'] });
    const router = createRouter({
      routeTree,
      history,
    });

    await act(async () => {
      render(<RouterProvider router={router} />);
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'No tienes acceso a esta sección' }),
    ).toBeInTheDocument();
  });

  it('renders UnexpectedErrorPage when route throws generic error without leaking details', async () => {
    const errorRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/crash-test',
      loader: () => {
        throw new Error('Database connection failed: password=supersecret');
      },
      component: () => <div>Normal content</div>,
    });

    const routeTree = rootRoute.addChildren([errorRoute]);
    const history = createMemoryHistory({ initialEntries: ['/crash-test'] });
    const router = createRouter({
      routeTree,
      history,
    });

    await act(async () => {
      render(<RouterProvider router={router} />);
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Algo salió mal' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/supersecret/i)).not.toBeInTheDocument();
  });
});
