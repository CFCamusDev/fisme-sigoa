import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible';

describe('Collapsible', () => {
  it('toggles aria-expanded and aria-controls', async () => {
    const user = userEvent.setup();
    render(
      <Collapsible>
        <CollapsibleTrigger type="button">Mostrar detalle</CollapsibleTrigger>
        <CollapsibleContent>Contenido colapsable</CollapsibleContent>
      </Collapsible>,
    );

    const trigger = screen.getByRole('button', { name: 'Mostrar detalle' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const controlsId = trigger.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    const content = screen.getByText('Contenido colapsable');
    expect(content).toBeVisible();
    expect(content).toHaveAttribute('id', controlsId);
    expect(content).toHaveClass(
      'overflow-hidden',
      'data-[state=open]:animate-collapsible-down',
      'data-[state=closed]:animate-collapsible-up',
    );
  });
});
