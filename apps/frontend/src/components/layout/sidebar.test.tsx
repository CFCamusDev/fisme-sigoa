import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { APP_VERSION } from '@/lib/app-version';
import { NAV_OPEN_GROUPS_STORAGE_KEY, Sidebar } from './sidebar';

const ADMIN_PERMISSIONS = [
  { code: 'usuario.ver', scope: 'GLOBAL' },
  { code: 'rol.ver', scope: 'GLOBAL' },
  { code: 'parametro.ver', scope: 'GLOBAL' },
  { code: 'catalogo.ver', scope: 'GLOBAL' },
  { code: 'resolucion.ver', scope: 'GLOBAL' },
  { code: 'plantilla.ver', scope: 'GLOBAL' },
  { code: 'documento.descargar', scope: 'GLOBAL' },
  { code: 'constituyente.ver', scope: 'GLOBAL' },
  { code: 'comite.ver', scope: 'GLOBAL' },
  { code: 'ejecucion.ver', scope: 'GLOBAL' },
  { code: 'sesion.ver', scope: 'GLOBAL' },
] as const;

describe('Sidebar grouped navigation (HU-082, T-082-12)', () => {
  it('renders six groups for an administrator', async () => {
    renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
      permissions: ADMIN_PERMISSIONS,
    });

    expect(await screen.findByRole('link', { name: 'Panel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Administración' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configuración' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Catálogo y documentos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grupos de interés' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gestión de calidad' })).toBeInTheDocument();
  });

  it('opens the group of the active route', async () => {
    renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
      initialEntries: ['/usuarios'],
      permissions: ADMIN_PERMISSIONS,
    });

    const adminGroup = await screen.findByRole('button', { name: 'Administración' });
    expect(adminGroup).toHaveAttribute('aria-expanded', 'true');
    const usersLink = screen.getByRole('link', { name: 'Usuarios' });
    expect(usersLink).toBeVisible();
    expect(usersLink).toHaveAttribute('aria-current', 'page');

    const configGroup = screen.getByRole('button', { name: 'Configuración' });
    expect(configGroup).toHaveAttribute('aria-expanded', 'false');
  });

  it('remembers the open groups across mounts', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
      permissions: ADMIN_PERMISSIONS,
    });

    const configGroup = await screen.findByRole('button', { name: 'Configuración' });
    expect(configGroup).toHaveAttribute('aria-expanded', 'false');

    await user.click(configGroup);
    expect(configGroup).toHaveAttribute('aria-expanded', 'true');
    expect(JSON.parse(window.localStorage.getItem(NAV_OPEN_GROUPS_STORAGE_KEY) ?? '[]')).toContain(
      'configuracion',
    );

    unmount();

    renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
      permissions: ADMIN_PERMISSIONS,
    });

    expect(await screen.findByRole('button', { name: 'Configuración' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Parámetros' })).toBeVisible();
  });

  it('ignores a corrupt or blocked stored value', async () => {
    window.localStorage.setItem(NAV_OPEN_GROUPS_STORAGE_KEY, '{not-valid-json');

    const { unmount } = renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
      permissions: ADMIN_PERMISSIONS,
    });

    const adminGroup = await screen.findByRole('button', { name: 'Administración' });
    expect(adminGroup).toHaveAttribute('aria-expanded', 'false');
    unmount();

    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    try {
      renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
        permissions: ADMIN_PERMISSIONS,
      });
      expect(await screen.findByRole('link', { name: 'Panel' })).toBeInTheDocument();
    } finally {
      getItemSpy.mockRestore();
    }
  });

  it('shows a skeleton per group while loading', async () => {
    let resolvePermissions!: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePermissions = resolve;
    });

    server.use(
      http.get('http://localhost:3000/me/permissions', async () => {
        await pendingPromise;
        return HttpResponse.json({
          permissions: [
            { code: 'usuario.ver', scope: 'GLOBAL' },
            { code: 'rol.ver', scope: 'GLOBAL' },
          ],
        });
      }),
    );

    renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
      permissions: null,
    });

    expect(await screen.findByRole('link', { name: 'Panel' })).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-group-skeleton-administracion')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-group-skeleton-configuracion')).toBeInTheDocument();

    resolvePermissions();

    expect(await screen.findByRole('button', { name: 'Administración' })).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-group-skeleton-administracion')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configuración' })).not.toBeInTheDocument();
  });

  it('fails closed and hides permission-gated groups when /me/permissions returns 500', async () => {
    server.use(
      http.get('http://localhost:3000/me/permissions', () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Error interno' } },
          { status: 500 },
        ),
      ),
    );

    renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
      permissions: null,
    });

    expect(await screen.findByRole('link', { name: 'Panel' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('sidebar-group-skeleton-administracion')).not.toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Configuración' })).not.toBeInTheDocument();
  });

  it('shares a single /me/permissions request across all sidebar groups under React.StrictMode', async () => {
    useAuthStore.getState().setAuthSession({
      accessToken: 'strict-token',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      user: {
        id: 'usr-sidebar-strict',
        names: 'Admin',
        firstSurname: 'Strict',
        secondSurname: null,
        email: 'admin.strict@untrm.edu.pe',
      },
    });

    let requestCount = 0;
    server.use(
      http.get('http://localhost:3000/me/permissions', () => {
        requestCount += 1;
        return HttpResponse.json({
          permissions: ADMIN_PERMISSIONS,
        });
      }),
    );

    renderWithProviders(
      <React.StrictMode>
        <Sidebar isOpen={false} onClose={vi.fn()} />
      </React.StrictMode>,
      { permissions: null },
    );

    expect(await screen.findByRole('button', { name: 'Administración' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configuración' })).toBeInTheDocument();
    expect(requestCount).toBe(1);
  });

  it('shows the build version', async () => {
    renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
      permissions: ADMIN_PERMISSIONS,
    });

    expect(await screen.findByText(`Versión ${APP_VERSION}`)).toBeInTheDocument();
  });
});
