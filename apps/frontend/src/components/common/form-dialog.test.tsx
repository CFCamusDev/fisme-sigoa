import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useRestoreFocus } from '@/hooks/use-restore-focus';
import { renderWithProviders } from '@/test/render';
import { useReportBusy } from './form-busy-context';
import { FormDialog } from './form-dialog';

function DemoForm({ onSubmitAsync }: { readonly onSubmitAsync: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  useReportBusy(busy);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onSubmitAsync();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Guardando…' : 'Enviar'}
    </button>
  );
}

function Harness({ onSubmitAsync }: { readonly onSubmitAsync: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const { remember, restore } = useRestoreFocus();

  return (
    <div>
      <button
        type="button"
        onClick={(event) => {
          remember(event.currentTarget);
          setOpen(true);
        }}
      >
        Abrir formulario
      </button>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Formulario de prueba"
        description="Descripción del formulario"
        onRestoreFocus={restore}
      >
        <DemoForm
          onSubmitAsync={async () => {
            await onSubmitAsync();
            setOpen(false);
          }}
        />
      </FormDialog>
    </div>
  );
}

describe('FormDialog (HU-082, T-082-33)', () => {
  it('renders the title with initial focus and restores focus to the opener', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness onSubmitAsync={async () => undefined} />, { withRouter: false });

    const opener = screen.getByRole('button', { name: 'Abrir formulario' });
    await user.click(opener);

    const title = await screen.findByRole('heading', { level: 2, name: 'Formulario de prueba' });
    expect(title).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('ignores Escape and outside clicks while the form is busy and closes after it settles', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    renderWithProviders(<Harness onSubmitAsync={() => gate} />, { withRouter: false });

    await user.click(screen.getByRole('button', { name: 'Abrir formulario' }));
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('button', { name: 'Guardando…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
