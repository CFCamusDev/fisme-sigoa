import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cssPath = path.resolve(__dirname, '../index.css');

export interface RGB {
  r: number;
  g: number;
  b: number;
  a?: number;
}

/**
 * Parsea un color hexadecimal (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) a valores RGB numéricos (0-255).
 */
export function parseHex(hex: string): RGB {
  let cleaned = hex.trim().replace(/^#/, '');

  if (cleaned.length === 3 || cleaned.length === 4) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  }

  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  const a = cleaned.length === 8 ? parseInt(cleaned.slice(6, 8), 16) / 255 : 1;

  return { r, g, b, a };
}

/**
 * Mezcla un color frontal con canal alfa sobre un color de fondo sólido.
 */
export function blendColors(fg: RGB, bg: RGB, alphaOverride?: number): RGB {
  const alpha = alphaOverride !== undefined ? alphaOverride : (fg.a ?? 1);
  return {
    r: Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    g: Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    b: Math.round(fg.b * alpha + bg.b * (1 - alpha)),
    a: 1,
  };
}

/**
 * Calcula la luminancia relativa según la fórmula WCAG 2.1.
 */
export function getRelativeLuminance({ r, g, b }: RGB): number {
  const sRGB = [r, g, b].map((val) => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (sRGB[0] ?? 0) + 0.7152 * (sRGB[1] ?? 0) + 0.0722 * (sRGB[2] ?? 0);
}

/**
 * Calcula la relación de contraste WCAG 2.1 entre dos colores (formato (L1 + 0.05) / (L2 + 0.05)).
 */
export function getContrastRatio(fg: RGB, bg: RGB): number {
  const l1 = getRelativeLuminance(fg);
  const l2 = getRelativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Math.round(ratio * 100) / 100;
}

/**
 * Carga y parsea todos los tokens de color de index.css.
 */
export function loadIndexCssTokens(): Record<string, string> {
  const css = fs.readFileSync(cssPath, 'utf8');
  const tokens: Record<string, string> = {
    white: '#ffffff',
    black: '#000000',
  };

  // 1. Extraer variables crudas (ej. --color-brand-700: #1d4570; o --primary: #1d4570;)
  const varRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match;
  const rawVars: Record<string, string> = {};

  while ((match = varRegex.exec(css)) !== null) {
    const key = match[1]?.trim();
    const val = match[2]?.trim();
    if (key && val) {
      rawVars[key] = val;
    }
  }

  // 2. Resolver valores
  for (const [key, rawVal] of Object.entries(rawVars)) {
    if (rawVal.startsWith('#')) {
      tokens[key] = rawVal;
      if (key.startsWith('color-')) {
        tokens[key.replace(/^color-/, '')] = rawVal;
      }
    } else if (rawVal.startsWith('var(')) {
      const targetVar = rawVal
        .replace(/^var\(--/, '')
        .replace(/\)$/, '')
        .trim();
      if (rawVars[targetVar] && rawVars[targetVar].startsWith('#')) {
        tokens[key] = rawVars[targetVar];
        if (key.startsWith('color-')) {
          tokens[key.replace(/^color-/, '')] = rawVars[targetVar];
        }
      }
    }
  }

  return tokens;
}
