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

  describe('Design tokens and accessibility (T-077-06b)', () => {
    it('applies design token classes across all variants without neutral or dark classes', () => {
      const { rerender } = render(<Button variant="default">Botón</Button>);
      let button = screen.getByRole('button');
      expect(button.className).toContain('bg-primary');
      expect(button.className).toContain('text-primary-foreground');
      expect(button.className).not.toContain('neutral');
      expect(button.className).not.toContain('dark:');

      rerender(<Button variant="outline">Botón</Button>);
      button = screen.getByRole('button');
      expect(button.className).toContain('border-primary');
      expect(button.className).toContain('text-primary');

      rerender(<Button variant="secondary">Botón</Button>);
      button = screen.getByRole('button');
      expect(button.className).toContain('bg-secondary');
      expect(button.className).toContain('text-secondary-foreground');

      rerender(<Button variant="ghost">Botón</Button>);
      button = screen.getByRole('button');
      expect(button.className).toContain('text-primary');
      expect(button.className).toContain('hover:bg-accent');

      rerender(<Button variant="destructive">Botón</Button>);
      button = screen.getByRole('button');
      expect(button.className).toContain('bg-destructive');
      expect(button.className).toContain('text-destructive-foreground');
      expect(button.className).not.toContain('red-');

      rerender(<Button variant="link">Botón</Button>);
      button = screen.getByRole('button');
      expect(button.className).toContain('text-brand-500');
    });

    it('applies institutional button heights and padding per size', () => {
      const { rerender } = render(<Button size="default">Botón</Button>);
      let button = screen.getByRole('button');
      expect(button.className).toContain('h-10');

      rerender(<Button size="sm">Botón</Button>);
      button = screen.getByRole('button');
      expect(button.className).toContain('h-8');

      rerender(<Button size="lg">Botón</Button>);
      button = screen.getByRole('button');
      expect(button.className).toContain('h-11');

      rerender(<Button size="icon">Botón</Button>);
      button = screen.getByRole('button');
      expect(button.className).toMatch(/size-10|h-10 w-10/);
    });

    it('ensures disabled button does not receive focus on Tab navigation', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <Button>Primero</Button>
          <Button disabled>Deshabilitado</Button>
          <Button>Tercero</Button>
        </div>,
      );

      const [first, disabled, third] = screen.getAllByRole('button');
      await user.tab();
      expect(first).toHaveFocus();
      await user.tab();
      expect(disabled).not.toHaveFocus();
      expect(third).toHaveFocus();
    });

    it('includes visible focus indicator classes on all variants', () => {
      const variants = ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'] as const;
      for (const variant of variants) {
        const { unmount } = render(<Button variant={variant}>Prueba</Button>);
        const btn = screen.getByRole('button');
        expect(btn.className).toContain('focus-visible:outline-2');
        expect(btn.className).toContain('focus-visible:outline-ring');
        unmount();
      }
    });

    it('preserves focusable target when rendered via asChild', async () => {
      const user = userEvent.setup();
      render(
        <Button asChild>
          <a href="#test">Enlace como botón</a>
        </Button>,
      );

      const link = screen.getByRole('link', { name: 'Enlace como botón' });
      await user.tab();
      expect(link).toHaveFocus();
    });
  });
});
