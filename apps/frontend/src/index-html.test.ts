import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Institutional HTML & Assets (T-077-02)', () => {
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  it('sets the institutional title and metadata in index.html', () => {
    expect(htmlContent).toContain('<title>FISME-SIGOA</title>');
    expect(htmlContent).toContain('<meta name="theme-color" content="#1D4570"');
    expect(htmlContent).toMatch(/<meta\s+name="description"\s+content="[^"]+"/i);
  });

  it('removes all references to vite.svg', () => {
    expect(htmlContent).not.toContain('vite.svg');
  });

  it('links to existing versioned assets under /assets/', () => {
    // Buscar todos los href de link tags que apuntan a rutas locales
    const hrefMatches = [...htmlContent.matchAll(/<link[^>]+href="([^"]+)"/g)];
    const localHrefs = hrefMatches
      .map((m) => m[1])
      .filter((href): href is string => Boolean(href && href.startsWith('/assets/')));

    expect(localHrefs.length).toBeGreaterThanOrEqual(2);

    for (const href of localHrefs) {
      // El href /assets/archivo debe existir en public/assets/archivo
      const relativePath = href.replace(/^\//, '');
      const assetFilePath = path.resolve(process.cwd(), 'public', relativePath);
      expect(
        fs.existsSync(assetFilePath),
        `Asset ${href} referenced in index.html must exist at ${assetFilePath}`,
      ).toBe(true);
    }
  });

  it('contains the versioned favicon and apple-touch-icon', () => {
    expect(htmlContent).toContain('/assets/favicon-v1.ico');
    expect(htmlContent).toContain('/assets/favicon-v1-32.png');
    expect(htmlContent).toContain('/assets/apple-touch-icon-v1.png');
  });
});
