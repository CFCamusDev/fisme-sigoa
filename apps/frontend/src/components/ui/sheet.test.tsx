import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet';
import { Button } from './button';

describe('Sheet', () => {
  it('renders the three widths with shadow-lg', () => {
    const { rerender } = render(
      <Sheet open>
        <SheetContent size="sm">
          <SheetHeader>
            <SheetTitle>Panel pequeño</SheetTitle>
            <SheetDescription>Detalle</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    let panel = screen.getByRole('dialog');
    expect(panel).toHaveClass(
      'w-[480px]',
      'shadow-lg',
      'z-[80]',
      'bg-card',
      'text-card-foreground',
    );

    rerender(
      <Sheet open>
        <SheetContent size="md">
          <SheetHeader>
            <SheetTitle>Panel mediano</SheetTitle>
            <SheetDescription>Detalle</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    panel = screen.getByRole('dialog');
    expect(panel).toHaveClass('w-[640px]', 'shadow-lg');

    rerender(
      <Sheet open>
        <SheetContent size="lg">
          <SheetHeader>
            <SheetTitle>Panel grande</SheetTitle>
            <SheetDescription>Detalle</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>,
    );

    panel = screen.getByRole('dialog');
    expect(panel).toHaveClass('w-[960px]', 'shadow-lg');
  });

  it('closes with Escape and restores focus', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger asChild>
          <Button type="button">Abrir panel</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Integrantes</SheetTitle>
            <SheetDescription>Gestión de integrantes</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <input aria-label="Nombre" />
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    );

    const trigger = screen.getByRole('button', { name: 'Abrir panel' });
    await user.click(trigger);

    const panel = await screen.findByRole('dialog');
    expect(panel).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('keeps the footer visible while the body scrolls', () => {
    render(
      <Sheet open>
        <SheetContent size="lg">
          <SheetHeader>
            <SheetTitle>Editor lateral</SheetTitle>
          </SheetHeader>
          <SheetBody data-testid="sheet-body">Contenido largo</SheetBody>
          <SheetFooter data-testid="sheet-footer">
            <Button type="button">Guardar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole('dialog')).toHaveClass('flex', 'flex-col');
    expect(screen.getByTestId('sheet-body')).toHaveClass('flex-1', 'overflow-y-auto');
    expect(screen.getByTestId('sheet-footer')).toHaveClass('shrink-0');
  });
});
