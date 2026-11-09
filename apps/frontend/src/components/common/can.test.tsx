import { type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { delay, http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { useAuthStore } from '@/stores/auth.store';
import { Can } from './can';

function setSessionForUser(userId = 'usr-can-test') {
  useAuthStore.getState().setAuthSession({
    accessToken: 'valid-token',
    accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    refreshTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    user: {
      id: userId,
      names: 'Usuario',
      firstSurname: 'Prueba',
      secondSurname: null,
      email: 'usuario@untrm.edu.pe',
    },
  });
}

function renderWithQueryClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Can component (HU-008, T-008-04, CA3, D8)', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuthSession();
  });

  it('renders nothing without the permission and renders nothing while loading', async () => {
    setSessionForUser();
    server.use(
      http.get('http://localhost:3000/me/permissions', async () => {
        await delay(20);
        return HttpResponse.json(
          {
            permissions: [{ code: 'catalogo.ver', scope: 'GLOBAL' }],
          },
          { status: 200 },
        );
      }),
    );

    renderWithQueryClient(
      <Can permission="usuario.crear">
        <button type="button">Crear usuario</button>
      </Can>,
    );

    // Mientras carga, falla cerrado y no muestra el botón
    expect(screen.queryByRole('button', { name: 'Crear usuario' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Crear usuario' })).not.toBeInTheDocument();
    });
  });

  it('renders children when the user has the required permission and scope', async () => {
    setSessionForUser();
    server.use(
      http.get('http://localhost:3000/me/permissions', () => {
        return HttpResponse.json(
          {
            permissions: [{ code: 'usuario.crear', scope: 'GLOBAL' }],
          },
          { status: 200 },
        );
      }),
    );

    renderWithQueryClient(
      <Can permission="usuario.crear">
        <button type="button">Crear usuario</button>
      </Can>,
    );

    expect(await screen.findByRole('button', { name: 'Crear usuario' })).toBeInTheDocument();
  });

  it('renders fallback only after loading completes when permission is denied', async () => {
    setSessionForUser();
    server.use(
      http.get('http://localhost:3000/me/permissions', async () => {
        await delay(20);
        return HttpResponse.json(
          {
            permissions: [],
          },
          { status: 200 },
        );
      }),
    );

    renderWithQueryClient(
      <Can permission="rol.editar" fallback={<span>Solo lectura</span>}>
        <button type="button">Guardar cambios</button>
      </Can>,
    );

    // Mientras carga no debe parpadear ni el hijo ni el fallback
    expect(screen.queryByText('Solo lectura')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument();

    expect(await screen.findByText('Solo lectura')).toBeInTheDocument();
  });
});
