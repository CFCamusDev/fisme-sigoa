import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { PuppeteerPdfGenerator } from '../shared/pdf/puppeteer-pdf-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../../');
const ciScriptsDir = path.resolve(rootDir, 'scripts/ci');

describe('CI Scripts Contract with Backend Adapters (T-077-13, 4b)', () => {
  it('ensures all generator methods called in CI scripts exist on PuppeteerPdfGenerator prototype', () => {
    const scriptFiles = fs
      .readdirSync(ciScriptsDir)
      .filter((file) => file.endsWith('.mjs'))
      .map((file) => path.join(ciScriptsDir, file));

    expect(scriptFiles.length).toBeGreaterThan(0);

    const prototypeMethods = new Set(
      Object.getOwnPropertyNames(PuppeteerPdfGenerator.prototype).filter(
        (prop) =>
          typeof (PuppeteerPdfGenerator.prototype as unknown as Record<string, unknown>)[prop] ===
          'function',
      ),
    );

    const violations: { file: string; line: number; method: string }[] = [];

    for (const filePath of scriptFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split(/\r?\n/);

      lines.forEach((line, index) => {
        // Ignorar comentarios
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          return;
        }

        // Buscar llamadas a generator.<método>(
        const matches = line.matchAll(/\bgenerator\.([a-zA-Z0-9_$]+)\s*\(/g);
        for (const match of matches) {
          const method = match[1];
          if (method && !prototypeMethods.has(method)) {
            violations.push({
              file: path.basename(filePath),
              line: index + 1,
              method,
            });
          }
        }
      });
    }

    expect(
      violations,
      `Se encontraron llamadas a métodos inexistentes de PuppeteerPdfGenerator en scripts CI:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });
});
