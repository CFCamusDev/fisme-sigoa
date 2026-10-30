import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('Design Tokens & Typography (T-077-01)', () => {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const cssPath = path.resolve(currentDir, 'index.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('defines the brand color scale centered at #1d4570', () => {
    expect(cssContent).toContain('--color-brand-700: #1d4570');
    expect(cssContent).toContain('--color-brand-50:');
    expect(cssContent).toContain('--color-brand-950:');
  });

  it('defines semantic tokens and shadcn bridges in hexadecimal', () => {
    expect(cssContent).toContain('--primary: #1d4570');
    expect(cssContent).toContain('--primary-hover: #163a62');
    expect(cssContent).toContain('--muted-foreground: #5b6b80');
    expect(cssContent).toContain('--color-primary: var(--primary)');
    expect(cssContent).toContain('--color-muted-foreground: var(--muted-foreground)');
  });

  it('configures Open Sans Variable without external CDNs', () => {
    expect(cssContent).toContain('"Open Sans Variable"');
    expect(cssContent).not.toContain('fonts.googleapis.com');
    expect(cssContent).not.toContain('http://');
    expect(cssContent).not.toContain('https://');
  });
});
