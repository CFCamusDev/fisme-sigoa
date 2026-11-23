import { useState } from 'react';
import { VOID_REASON_MIN_LENGTH } from '@sigoa/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  it('requires the reason minimum from the shared constant', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Anular ejecución"
        description="Esta acción no se puede deshacer."
        confirmLabel="Confirmar anulación"
        tone="destructive"
        reason={{
          label: 'Motivo de anulación',
          minLength: VOID_REASON_MIN_LENGTH,
          maxLength: 500,
        }}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('w-[480px]');

    const textarea = screen.getByLabelText('Motivo de anulación');
    await user.type(textarea, '   corto   ');
    await user.click(screen.getByRole('button', { name: 'Confirmar anulación' }));

    expect(
      screen.getByText(`El motivo debe tener al menos ${VOID_REASON_MIN_LENGTH} caracteres.`),
    ).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    const validReason = 'A'.repeat(VOID_REASON_MIN_LENGTH);
    await user.clear(textarea);
    await user.type(textarea, validReason);
    await user.click(screen.getByRole('button', { name: 'Confirmar anulación' }));

    expect(onConfirm).toHaveBeenCalledWith(validReason);
  });

  it('confirms once when the confirm button is activated twice and ignores Escape while pending', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;

    function ConfirmHarness() {
      const [open, setOpen] = useState(true);
      const [isPending, setIsPending] = useState(false);

      return (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Inactivar usuario"
          description="Se cerrarán sus sesiones activas."
          confirmLabel="Inactivar"
          pendingLabel="Inactivando…"
          tone="destructive"
          isPending={isPending}
          onConfirm={async () => {
            calls += 1;
            setIsPending(true);
            await gate;
            setIsPending(false);
            setOpen(false);
          }}
        />
      );
    }

    render(<ConfirmHarness />);

    const confirmButton = screen.getByRole('button', { name: 'Inactivar' });
    await user.click(confirmButton);

    const pendingButton = await screen.findByRole('button', { name: 'Inactivando…' });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute('aria-busy', 'true');

    await user.click(pendingButton);
    expect(calls).toBe(1);

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    release();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(calls).toBe(1);
  });
});
