import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

describe('Tooltip', () => {
  it('shows on keyboard focus and hides with Escape', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button">Ayuda</button>
        </TooltipTrigger>
        <TooltipContent>Texto de ayuda</TooltipContent>
      </Tooltip>,
    );

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Ayuda' })).toHaveFocus();

    const tooltip = await screen.findByRole('tooltip', { name: 'Texto de ayuda' });
    expect(tooltip).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
