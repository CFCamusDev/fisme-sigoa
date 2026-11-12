// @vitest-environment node
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findViolations, scanDirectory } from './check-design-tokens.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.resolve(__dirname, 'check-design-tokens.mjs');

describe('check-design-tokens guard (T-077-11)', () => {
  it('fails on a forbidden color class (standard palette)', () => {
    const snippet = '<div className="bg-neutral-900 hover:bg-sky-900/90 focus-visible:ring-red-500" />';
    const violations = findViolations(snippet, 'test.tsx');

    expect(violations.length).toBeGreaterThanOrEqual(3);
    const matches = violations.map((v) => v.match);
    expect(matches).toContain('bg-neutral-900');
    expect(matches).toContain('hover:bg-sky-900/90');
    expect(matches).toContain('focus-visible:ring-red-500');
  });

  it('passes with design tokens and neutral utilities like text-white', () => {
    const snippet = '<div className="bg-primary text-muted-foreground bg-brand-700 text-white border-idle-border text-meta" />';
    const violations = findViolations(snippet, 'test.tsx');

    expect(violations).toEqual([]);
  });

  it('fails on a hexadecimal color outside comments and ignores in-page anchors like #main-content', () => {
    const snippetBad = 'const color = "#1d4570";\nconst link = <a href="#main-content">Skip</a>;';
    const violations = findViolations(snippetBad, 'test.tsx');

    expect(violations.length).toBe(1);
    expect(violations[0]?.match).toBe('#1d4570');
  });

  it('fails on arbitrary color values', () => {
    const snippet = '<div className="bg-[#1d4570] text-[rgb(20,30,40)]" />';
    const violations = findViolations(snippet, 'test.tsx');

    expect(violations.length).toBeGreaterThanOrEqual(2);
    const matches = violations.map((v) => v.match);
    expect(matches).toContain('bg-[#1d4570]');
    expect(matches).toContain('text-[rgb(20,30,40)]');
  });

  it('fails on the dark variant', () => {
    const snippet = '<div className="dark:bg-brand-900 dark:text-white" />';
    const violations = findViolations(snippet, 'test.tsx');

    expect(violations.length).toBeGreaterThanOrEqual(2);
    const matches = violations.map((v) => v.match);
    expect(matches).toContain('dark:bg-brand-900');
    expect(matches).toContain('dark:text-white');
  });

  it('honors the allow comment only with a reason', () => {
    const snippetValidReason = 'const chartColor = "#1D4570"; // design-tokens:allow requerido por Recharts OEP1';
    expect(findViolations(snippetValidReason, 'chart.ts')).toEqual([]);

    const snippetEmptyReason = 'const chartColor = "#1D4570"; // design-tokens:allow';
    const violations = findViolations(snippetEmptyReason, 'chart.ts');
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => /motivo obligatorio/i.test(v.message))).toBe(true);
  });

  it('reports file, line and column correctly', () => {
    const snippet = 'const safe = 1;\nconst bad = "#ff0000";';
    const violations = findViolations(snippet, 'src/components/bad.tsx');

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      file: 'src/components/bad.tsx',
      line: 2,
      column: 14,
      match: '#ff0000',
    });
  });

  it('scans a directory and exits with code 1 when violations exist', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigoa-tokens-test-'));
    try {
      const badFile = path.join(tempDir, 'bad-component.tsx');
      fs.writeFileSync(badFile, '<div className="bg-neutral-900" />', 'utf8');

      const result = spawnSync('node', [scriptPath, tempDir], {
        encoding: 'utf8',
        timeout: 15_000,
      });

      expect(result.status).toBe(1);
      const output = (result.stdout || '') + (result.stderr || '');
      expect(output).toContain('bad-component.tsx:1');
      expect(output).toContain('bg-neutral-900');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('the real source tree has no violations', () => {
    const frontendSrc = path.resolve(__dirname, '../src');
    const violations = scanDirectory(frontendSrc);

    expect(violations).toEqual([]);
  });
});
