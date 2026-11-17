import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { Route } from './ejecuciones';

describe('ProcessExecutionsRoute (/ejecuciones) (HU-027, T-027-21)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearSession();
  });

  it('redirects without ejecucion.ver', () => {
    useAuthStore.getState().setSession({
      accessToken: 'token',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {
        id: 'user-1',
        names: 'Ana',
        firstSurname: 'Torres',
        secondSurname: 'Paz',
        email: 'ana@untrm.edu.pe',
      },
      permissions: [{ code: 'catalogo.ver', scope: 'GLOBAL' }],
    });

    const beforeLoad = Route.options.beforeLoad as (() => unknown) | undefined;
    expect(typeof beforeLoad).toBe('function');
    expect(() => beforeLoad?.()).toThrow();
  });

  it('renders the page when authenticated with ejecucion.ver', async () => {
    server.use(
      http.get('*/process-executions', () =>
        HttpResponse.json({
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        }),
      ),
    );

    const Component = Route.options.component;
    expect(Component).toBeDefined();
    if (Component) {
      renderWithProviders(<Component />, {
        withRouter: false,
        permissions: [{ code: 'ejecucion.ver', scope: 'GLOBAL' }],
      });
      expect(
        screen.getByRole('heading', { level: 1, name: /ejecuciones de proceso/i }),
      ).toBeInTheDocument();
      expect(await screen.findByText(/Aún no hay ejecuciones/i)).toBeInTheDocument();
    }
  });
});
