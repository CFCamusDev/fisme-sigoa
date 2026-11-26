import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import { Button } from './button';

describe('Dialog', () => {
  it('renders the 480, 640 and 960 widths', () => {
    const { rerender } = render(
      <Dialog open>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Confirmar</DialogTitle>
            <DialogDescription>Detalle breve</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    let dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('w-[480px]', 'max-w-[calc(100vw-2rem)]', 'z-[80]', 'shadow-xl');

    rerender(
      <Dialog open>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Formulario</DialogTitle>
            <DialogDescription>Detalle breve</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('w-[640px]');

    rerender(
      <Dialog open>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Editor</DialogTitle>
            <DialogDescription>Detalle breve</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('w-[960px]');
  });

  it('traps focus and closes with Escape returning focus to the opener', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button">Abrir diálogo</Button>
        </DialogTrigger>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Título del diálogo</DialogTitle>
            <DialogDescription>Descripción del diálogo</DialogDescription>
          </DialogHeader>
          <input aria-label="Campo de prueba" />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole('button', { name: 'Abrir diálogo' });
    await user.click(trigger);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.tab();
    await user.tab();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('warns about no missing title or description', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      render(
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solo título</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>,
      );

      expect(screen.getByRole('dialog', { name: 'Solo título' })).toBeInTheDocument();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
