import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button component (React 19 & Tailwind v4)', () => {
  it('renders default button with accessible text', () => {
    render(<Button>Guardar</Button>);
    const button = screen.getByRole('button', { name: /guardar/i });
    expect(button).toBeInTheDocument();
  });

  it('triggers onClick handler when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Enviar</Button>);
    const button = screen.getByRole('button', { name: /enviar/i });

    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onClick when disabled', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={handleClick}>
        Deshabilitado
      </Button>,
    );
    const button = screen.getByRole('button', { name: /deshabilitado/i });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders correctly as a child element using asChild (Slot)', () => {
    render(
      <Button asChild>
        <a href="/login">Ir a login</a>
      </Button>,
    );

    const link = screen.getByRole('link', { name: /ir a login/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/login');
  });

  it('forwards ref correctly via direct prop in React 19', () => {
    const ref = React.createRef<HTMLButtonElement>();

    render(<Button ref={ref}>Con Referencia</Button>);

    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toBe('Con Referencia');
  });
});
