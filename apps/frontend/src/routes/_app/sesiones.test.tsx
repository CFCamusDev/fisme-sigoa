import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { Route } from './sesiones';

describe('SessionsRoute (/sesiones) (HU-032, T-032-25)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
  });

  it('redirects without sesion.ver', async () => {
    const beforeLoad = Route.options.beforeLoad as (() => Promise<unknown>) | undefined;
    expect(typeof beforeLoad).toBe('function');
    await expect(beforeLoad?.()).rejects.toBeDefined();
  });

  it('renders the page when authenticated with sesion.ver', async () => {
    server.use(
      http.get('*/process-executions', () =>
        HttpResponse.json({
          items: [],
          page: 1,
          pageSize: 100,
          total: 0,
          totalPages: 0,
        }),
      ),
    );

    const Component = Route.options.component;
    expect(Component).toBeDefined();
    if (Component) {
      renderWithProviders(<Component />, {
        withRouter: true,
        permissions: [{ code: 'sesion.ver', scope: 'GLOBAL' }],
      });
      expect(screen.getByRole('heading', { level: 1, name: /Sesiones/i })).toBeInTheDocument();
      expect(
        await screen.findByText(/No existen ejecuciones de proceso registradas/i),
      ).toBeInTheDocument();
    }
  });
});
