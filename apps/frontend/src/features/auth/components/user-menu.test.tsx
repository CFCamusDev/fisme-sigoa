import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { UserMenu } from './user-menu';

describe('UserMenu', () => {
  it('shows the user name and logs out from the menu', async () => {
    const user = userEvent.setup();
    let logoutCalled = false;
    server.use(
      http.post('http://localhost:3000/auth/logout', () => {
        logoutCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<UserMenu />);

    const trigger = await screen.findByRole('button', { name: /Menú de usuario de Admin Test/i });
    expect(trigger).toHaveTextContent('Admin Test');

    await user.click(trigger);

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    const logoutItem = screen.getByRole('menuitem', { name: 'Cerrar sesión' });
    await user.click(logoutItem);

    await waitFor(() => {
      expect(logoutCalled).toBe(true);
    });
    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  it('sends a single logout request when the option is activated twice', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requestCount = 0;

    server.use(
      http.post('http://localhost:3000/auth/logout', async () => {
        requestCount += 1;
        await gate;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderWithProviders(<UserMenu />);

    await user.click(await screen.findByRole('button', { name: /Menú de usuario de Admin Test/i }));

    const logoutItem = await screen.findByRole('menuitem', { name: 'Cerrar sesión' });
    await user.click(logoutItem);

    const busyItem = await screen.findByRole('menuitem', { name: 'Cerrando sesión…' });
    expect(busyItem).toHaveAttribute('aria-busy', 'true');
    expect(busyItem).toHaveAttribute('aria-disabled', 'true');

    await user.click(busyItem);
    expect(requestCount).toBe(1);

    release();

    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
    expect(requestCount).toBe(1);
  });
});
