import { describe, expect, it } from 'vitest';
import { LOGO_VARIANT_NAMES, LOGO_VARIANTS } from '@sigoa/shared';
import { LogoUrlResolver } from './logo-url-resolver.js';

describe('LogoUrlResolver (T-077-05)', () => {
  const baseUrl = 'https://sigoa.unterm.edu.pe';

  it('resolves the public URL for every variant', () => {
    const resolver = new LogoUrlResolver(baseUrl);

    for (const variant of LOGO_VARIANT_NAMES) {
      const url = resolver.resolve(variant);
      expect(url).toBe(`${baseUrl}/assets/${LOGO_VARIANTS[variant].file}`);
      expect(url).not.toContain('//assets');
    }
  });

  it('strips trailing slashes from baseUrl to avoid double slashes', () => {
    const resolver = new LogoUrlResolver('https://sigoa.unterm.edu.pe///');
    const url = resolver.resolve('square');
    expect(url).toBe('https://sigoa.unterm.edu.pe/assets/logo-untrm-v1-256.png');
  });

  it('resolves icon, square and horizontal variants explicitly', () => {
    const resolver = new LogoUrlResolver('http://localhost:5173');
    expect(resolver.resolve('icon')).toBe('http://localhost:5173/assets/logo-untrm-v1-64.png');
    expect(resolver.resolve('square')).toBe('http://localhost:5173/assets/logo-untrm-v1-256.png');
    expect(resolver.resolve('horizontal')).toBe(
      'http://localhost:5173/assets/logo-untrm-v1-256.png',
    );
  });
});
