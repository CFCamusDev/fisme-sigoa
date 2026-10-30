import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRootDir = path.resolve(__dirname, '..');
const e2eDir = path.resolve(frontendRootDir, 'e2e');

describe('E2E Test Hygiene and Explicit Timeouts (Frontend)', () => {
  it('ensures e2e specs have no waitForTimeout, skip or only calls', () => {
    const files = fs.readdirSync(e2eDir).filter((f) => f.endsWith('.spec.ts'));
    expect(files.length).toBeGreaterThan(0);

    const violations: { file: string; rule: string; line: number }[] = [];

    for (const file of files) {
      const fullPath = path.join(e2eDir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split(/\r?\n/);

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          return;
        }

        if (/\bwaitForTimeout\s*\(/.test(line)) {
          violations.push({ file, rule: 'waitForTimeout()', line: index + 1 });
        }
        if (/\.skip\s*\(/.test(line)) {
          violations.push({ file, rule: '.skip', line: index + 1 });
        }
        if (/\.only\s*\(/.test(line)) {
          violations.push({ file, rule: '.only', line: index + 1 });
        }
      });
    }

    expect(
      violations,
      `Se encontraron violaciones de higiene en especificaciones E2E:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });

  it('ensures playwright.config.ts declares explicit timeouts for tests, assertions and actions', () => {
    const configFile = path.resolve(frontendRootDir, 'playwright.config.ts');
    const content = fs.readFileSync(configFile, 'utf-8');

    // timeout por prueba (30s)
    expect(content).toMatch(/timeout:\s*30_?000/);
    // expect.timeout (10s)
    expect(content).toMatch(/expect:\s*\{\s*timeout:\s*10_?000,?\s*\}/);
    // use.actionTimeout (10s)
    expect(content).toMatch(/actionTimeout:\s*10_?000/);
    // use.navigationTimeout (15s)
    expect(content).toMatch(/navigationTimeout:\s*15_?000/);
    // globalTimeout en CI (15m = 900_000 o 15 * 60 * 1000)
    expect(content).toMatch(/globalTimeout:\s*(?:15\s*\*\s*60\s*\*\s*1000|900_?000)/);
  });
});
