import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

describe('DropdownMenu', () => {
  it('opens with Enter, moves with arrows, closes with Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Cuenta</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Ana Torres</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Perfil</DropdownMenuItem>
          <DropdownMenuItem onSelect={onLogout}>Cerrar sesión</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByRole('button', { name: 'Cuenta' });
    trigger.focus();

    await user.keyboard('{Enter}');
    const menu = await screen.findByRole('menu');
    expect(menu).toBeInTheDocument();

    const perfil = screen.getByRole('menuitem', { name: 'Perfil' });
    const logout = screen.getByRole('menuitem', { name: 'Cerrar sesión' });

    await user.keyboard('{ArrowDown}');
    expect(logout).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(perfil).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });
});
