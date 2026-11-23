import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const indexCssPath = path.resolve(import.meta.dirname, '../index.css');
const indexCss = fs.readFileSync(indexCssPath, 'utf8');

describe('motion tokens in index.css', () => {
  it('defines 150ms color and 200ms panel durations with ease-standard', () => {
    expect(indexCss).toContain('--motion-color: 150ms;');
    expect(indexCss).toContain('--motion-panel: 200ms;');
    expect(indexCss).toContain('--ease-standard: cubic-bezier(0.2, 0, 0, 1);');
    expect(indexCss).toMatch(/@utility\s+motion-color\s*\{[\s\S]*var\(--motion-color\)/);
    expect(indexCss).toMatch(/@utility\s+motion-panel\s*\{[\s\S]*var\(--motion-panel\)/);
    expect(indexCss).toContain('@keyframes collapsible-down');
    expect(indexCss).toContain('@keyframes collapsible-up');
    expect(indexCss).toContain('--radix-collapsible-content-height');
  });

  it('disables animations and transitions under prefers-reduced-motion', () => {
    const match = indexCss.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/);
    expect(match).not.toBeNull();
    const block = match?.[0] ?? '';
    expect(block).toContain('animation-duration: 0.01ms !important;');
    expect(block).toContain('transition-duration: 0.01ms !important;');
    expect(block).toContain('animation-iteration-count: 1 !important;');
  });
});
