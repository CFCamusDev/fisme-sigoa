import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { Sidebar } from './sidebar';

describe('Sidebar permission-aware menu filtering (HU-008, T-008-08, CA3)', () => {
  it('renders skeletons while permissions are loading and then reveals permitted links', async () => {
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
            { code: 'parametro.ver', scope: 'GLOBAL' },
          ],
        });
      }),
    );

    renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
      permissions: null,
    });

    expect(await screen.findByRole('link', { name: 'Panel' })).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-skeleton-/usuarios')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-skeleton-/roles')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-skeleton-/configuracion/programa')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Programa' })).not.toBeInTheDocument();

    resolvePermissions();

    expect(await screen.findByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Roles' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Programa' })).toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-skeleton-/usuarios')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sidebar-skeleton-/roles')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('sidebar-skeleton-/configuracion/programa'),
    ).not.toBeInTheDocument();
  });

  it('hides menu entries the user cannot access (e.g. Teacher role)', async () => {
    renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
      permissions: [
        { code: 'medicion_directa.registrar', scope: 'OWN' },
        { code: 'encuesta.responder', scope: 'OWN' },
      ],
    });

    expect(await screen.findByRole('link', { name: 'Panel' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Programa' })).not.toBeInTheDocument();
  });

  it('renders only permitted entries when the user has partial permissions (usuario.ver only)', async () => {
    renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
      permissions: [{ code: 'usuario.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByRole('link', { name: 'Panel' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Programa' })).not.toBeInTheDocument();
  });

  it('shows Programa when user has parametro.ver and hides it when missing (HU-009, T-009-12)', async () => {
    renderWithProviders(<Sidebar isOpen={false} onClose={vi.fn()} />, {
      permissions: [{ code: 'parametro.ver', scope: 'GLOBAL' }],
    });

    expect(await screen.findByRole('link', { name: 'Panel' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Programa' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
  });

  it('fails closed and hides permission-gated links when /me/permissions returns 500', async () => {
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
      expect(screen.queryByTestId('sidebar-skeleton-/usuarios')).not.toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Roles' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Programa' })).not.toBeInTheDocument();
  });

  it('shares a single /me/permissions request across all sidebar items under React.StrictMode', async () => {
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
          permissions: [
            { code: 'usuario.ver', scope: 'GLOBAL' },
            { code: 'rol.ver', scope: 'GLOBAL' },
            { code: 'parametro.ver', scope: 'GLOBAL' },
          ],
        });
      }),
    );

    renderWithProviders(
      <React.StrictMode>
        <Sidebar isOpen={false} onClose={vi.fn()} />
      </React.StrictMode>,
      { permissions: null },
    );

    expect(await screen.findByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Roles' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Programa' })).toBeInTheDocument();
    expect(requestCount).toBe(1);
  });
});
