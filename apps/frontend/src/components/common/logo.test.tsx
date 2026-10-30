import fs from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LOGO_ALT_TEXT, LOGO_VARIANT_NAMES, LOGO_VARIANTS } from '@sigoa/shared';
import { Logo } from './logo';
import { getLogoUrl } from '../../lib/logo';

describe('Logo Component & Helper (T-077-04)', () => {
  it('every variant file in LOGO_VARIANTS physically exists in public/assets', () => {
    for (const variant of LOGO_VARIANT_NAMES) {
      const file = LOGO_VARIANTS[variant].file;
      const physicalPath = path.resolve(process.cwd(), 'public', 'assets', file);
      expect(
        fs.existsSync(physicalPath),
        `Asset file ${file} for variant ${variant} must exist in public/assets`,
      ).toBe(true);
    }
  });

  it('generates the correct URL for each variant with getLogoUrl', () => {
    expect(getLogoUrl('icon')).toBe('/assets/logo-untrm-v1-64.png');
    expect(getLogoUrl('square')).toBe('/assets/logo-untrm-v1-256.png');
    expect(getLogoUrl('horizontal')).toBe('/assets/logo-untrm-v1-256.png');
  });

  it('renders default square variant with institutional alt text', () => {
    render(<Logo />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/assets/logo-untrm-v1-256.png');
    expect(img).toHaveAttribute('alt', LOGO_ALT_TEXT);
    expect(img).toHaveAttribute('width', '32');
    expect(img).toHaveAttribute('height', '32');
  });

  it('renders icon variant', () => {
    render(<Logo variant="icon" size={48} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/assets/logo-untrm-v1-64.png');
    expect(img).toHaveAttribute('width', '48');
    expect(img).toHaveAttribute('height', '48');
  });

  it('enforces a minimum size of 32px even if a smaller value is passed', () => {
    render(<Logo size={16} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('width', '32');
    expect(img).toHaveAttribute('height', '32');
  });

  it('renders with empty alt text when decorative is true', () => {
    const { container } = render(<Logo decorative />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('alt')).toBe('');
  });

  it('renders horizontal variant with shield and FISME-SIGOA text', () => {
    render(<Logo variant="horizontal" size={40} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/assets/logo-untrm-v1-256.png');
    expect(img).toHaveAttribute('width', '40');
    expect(img).toHaveAttribute('height', '40');
    expect(screen.getByText('FISME-SIGOA')).toBeInTheDocument();
  });
});
