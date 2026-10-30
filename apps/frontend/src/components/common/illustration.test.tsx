import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Illustration } from './illustration';
import { ILLUSTRATIONS } from '@/lib/illustrations';

describe('Illustration Component (T-077-08a)', () => {
  it('renders decorative image with empty alt and aria-hidden="true"', () => {
    const { container } = render(<Illustration name="empty" />);
    const img = container.querySelector('img');

    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(img).toHaveAttribute('src', ILLUSTRATIONS.empty);
  });

  it('applies default width and allows size overrides', () => {
    const { container, rerender } = render(<Illustration name="error" />);
    let img = container.querySelector('img');
    expect(img).toHaveAttribute('width', '180');

    rerender(<Illustration name="error" size={240} />);
    img = container.querySelector('img');
    expect(img).toHaveAttribute('width', '240');
  });

  it('forwards custom className', () => {
    const { container } = render(<Illustration name="noResults" className="mx-auto my-4" />);
    const img = container.querySelector('img');
    expect(img?.className).toContain('mx-auto');
    expect(img?.className).toContain('my-4');
  });
});
