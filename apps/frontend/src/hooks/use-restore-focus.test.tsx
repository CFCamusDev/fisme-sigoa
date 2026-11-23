import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useRestoreFocus } from './use-restore-focus';

function RestoreFocusHarness() {
  const { remember, restore } = useRestoreFocus();
  const [showButton, setShowButton] = useState(true);

  return (
    <div>
      <main id="main-content" tabIndex={-1}>
        Contenido principal
      </main>
      {showButton ? (
        <button type="button" onClick={(e) => remember(e.currentTarget)}>
          Recordar botón
        </button>
      ) : null}
      <button type="button" onClick={() => setShowButton(false)}>
        Quitar botón
      </button>
      <button type="button" onClick={() => restore()}>
        Restaurar foco
      </button>
    </div>
  );
}

describe('useRestoreFocus', () => {
  it('restores focus to the remembered opener', async () => {
    const user = userEvent.setup();
    render(<RestoreFocusHarness />);

    const rememberBtn = screen.getByRole('button', { name: 'Recordar botón' });
    await user.click(rememberBtn);
    await user.click(screen.getByRole('button', { name: 'Restaurar foco' }));

    expect(rememberBtn).toHaveFocus();
  });

  it('falls back to main when the opener was removed', async () => {
    const user = userEvent.setup();
    render(<RestoreFocusHarness />);

    await user.click(screen.getByRole('button', { name: 'Recordar botón' }));
    await user.click(screen.getByRole('button', { name: 'Quitar botón' }));
    await user.click(screen.getByRole('button', { name: 'Restaurar foco' }));

    expect(screen.getByRole('main')).toHaveFocus();
  });
});
