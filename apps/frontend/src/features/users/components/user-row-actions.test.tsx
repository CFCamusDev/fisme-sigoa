import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { UserDto } from '@sigoa/shared';
import { server } from '@/test/msw/server';
import { renderWithProviders } from '@/test/render';
import { UserRowActions } from './user-row-actions';

const activeUser: UserDto = {
  id: 'usr-10',
  email: 'carlos.mendoza@example.test',
  names: 'Carlos',
  firstSurname: 'Mendoza',
  secondSurname: null,
  dni: '12345678',
  status: 'ACTIVE',
  roles: [],
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

const inactiveUser: UserDto = {
  ...activeUser,
  id: 'usr-11',
  status: 'INACTIVE',
};

describe('UserRowActions', () => {
  it('asks for confirmation before Inactivar and Reactivar', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<UserRowActions user={activeUser} />);

    await user.click(await screen.findByRole('button', { name: 'Inactivar a Carlos Mendoza' }));
    const inactivateDialog = await screen.findByRole('dialog');
    expect(inactivateDialog).toHaveTextContent('Inactivar usuario');
    expect(inactivateDialog).toHaveTextContent(
      '¿Inactivar a Carlos Mendoza? Se cerrarán sus sesiones activas.',
    );
    expect(inactivateDialog).toHaveClass('w-[480px]');
    await user.keyboard('{Escape}');
    unmount();

    renderWithProviders(<UserRowActions user={inactiveUser} />);
    await user.click(await screen.findByRole('button', { name: 'Reactivar a Carlos Mendoza' }));
    const reactivateDialog = await screen.findByRole('dialog');
    expect(reactivateDialog).toHaveTextContent('Reactivar usuario');
    expect(reactivateDialog).toHaveTextContent(
      '¿Reactivar la cuenta de Carlos Mendoza? Podrá volver a iniciar sesión.',
    );
  });

  it('sends a single status change when Inactivar is confirmed twice', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let patchCount = 0;

    server.use(
      http.patch('http://localhost:3000/users/usr-10/status', async () => {
        patchCount += 1;
        await gate;
        return HttpResponse.json({ ...activeUser, status: 'INACTIVE' });
      }),
    );

    renderWithProviders(<UserRowActions user={activeUser} onStatusChangeSuccess={onSuccess} />);

    await user.click(await screen.findByRole('button', { name: 'Inactivar a Carlos Mendoza' }));

    const confirmBtn = await screen.findByRole('button', { name: 'Inactivar' });
    await user.click(confirmBtn);

    const pendingBtn = await screen.findByRole('button', { name: 'Inactivando…' });
    expect(pendingBtn).toBeDisabled();
    await user.click(pendingBtn);
    expect(patchCount).toBe(1);

    release();
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        'Se inactivó la cuenta de Carlos Mendoza correctamente.',
      );
    });
    expect(patchCount).toBe(1);
  });
});
