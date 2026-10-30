import { describe, expect, it } from 'vitest';
import { blendColors, getContrastRatio, loadIndexCssTokens, parseHex } from './test/contrast';
import { TONE_CLASSES, type StatusTone } from './lib/status';

describe('Design Tokens WCAG 2.1 AA Contrast Ratios (T-077-12a)', () => {
  const tokens = loadIndexCssTokens();

  function expectMinContrast(fgName: string, bgName: string, minRatio = 4.5, fgAlpha?: number) {
    const fgHex = tokens[fgName];
    const bgHex = tokens[bgName];

    expect(fgHex, `Token ${fgName} debe existir en index.css`).toBeDefined();
    expect(bgHex, `Token ${bgName} debe existir en index.css`).toBeDefined();

    if (!fgHex || !bgHex) return;

    let fgRgb = parseHex(fgHex);
    const bgRgb = parseHex(bgHex);

    if (fgAlpha !== undefined) {
      fgRgb = blendColors(fgRgb, bgRgb, fgAlpha);
    }

    const ratio = getContrastRatio(fgRgb, bgRgb);
    expect(
      ratio,
      `Contraste de "${fgName}" sobre "${bgName}" (${ratio}:1) debe ser >= ${minRatio}:1`,
    ).toBeGreaterThanOrEqual(minRatio);
  }

  it('meets normal text contrast >= 4.5:1 on base semantic tokens', () => {
    // Texto principal sobre fondos base
    expectMinContrast('foreground', 'background', 4.5);
    expectMinContrast('card-foreground', 'card', 4.5);

    // Botón primario y estado hover
    expectMinContrast('primary-foreground', 'primary', 4.5);
    expectMinContrast('primary-foreground', 'primary-hover', 4.5);

    // Botón secundario y hover
    expectMinContrast('secondary-foreground', 'secondary', 4.5);
    expectMinContrast('secondary-foreground', 'brand-200', 4.5);

    // Texto atenuado (muted-foreground) en todos los fondos donde se usa
    expectMinContrast('muted-foreground', 'background', 4.5);
    expectMinContrast('muted-foreground', 'card', 4.5);
    expectMinContrast('muted-foreground', 'muted', 4.5);
    expectMinContrast('muted-foreground', 'secondary', 4.5);

    // Botón destructivo y hover (con 90% opacidad)
    expectMinContrast('destructive-foreground', 'destructive', 4.5);
    expectMinContrast('destructive-foreground', 'destructive', 4.5, 0.9);

    // Navegación: barra superior y barra lateral
    expectMinContrast('topbar-foreground', 'topbar', 4.5);
    expectMinContrast('sidebar-foreground', 'sidebar', 4.5);
    expectMinContrast('sidebar-foreground', 'brand-50', 4.5);
    expectMinContrast('sidebar-active-foreground', 'sidebar-active', 4.5);

    // Enlaces de marca (brand-500)
    expectMinContrast('brand-500', 'background', 4.5);
    expectMinContrast('brand-500', 'card', 4.5);

    // Cabecera de tablas (brand-700 sobre brand-100)
    expectMinContrast('brand-700', 'brand-100', 4.5);
  });

  it('meets UI component boundaries and focus ring contrast >= 3.0:1 (WCAG 1.4.11)', () => {
    expectMinContrast('input', 'card', 3.0);
    expectMinContrast('ring', 'card', 3.0);
  });

  it('meets WCAG AA >= 4.5:1 for every status tone in TONE_CLASSES', () => {
    for (const [toneName, classString] of Object.entries(TONE_CLASSES) as [StatusTone, string][]) {
      // Extraer nombre del token de fondo (bg-*) y de texto (text-*)
      const bgMatch = classString.match(/\bbg-([a-zA-Z0-9_-]+)/);
      const textMatch = classString.match(/\btext-([a-zA-Z0-9_-]+)/);

      expect(bgMatch, `Tono ${toneName} debe definir una clase bg-*`).toBeDefined();
      expect(textMatch, `Tono ${toneName} debe definir una clase text-*`).toBeDefined();

      const bgToken = bgMatch?.[1] ?? '';
      const textToken = textMatch?.[1] ?? '';

      expectMinContrast(textToken, bgToken, 4.5);
    }
  });
});
