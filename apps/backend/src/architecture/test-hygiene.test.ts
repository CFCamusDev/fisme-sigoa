import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRootDir = path.resolve(__dirname, '../..');
const backendSrcDir = path.resolve(__dirname, '..');

function findFilesRecursively(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'coverage') {
        results.push(...findFilesRecursively(fullPath, pattern));
      }
    } else if (entry.isFile() && pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

describe('Test Hygiene & Explicit Timeouts (Backend)', () => {
  it('ensures no integration tests use fixed sleeps, timeouts, skip or only', () => {
    const integrationFiles = findFilesRecursively(backendSrcDir, /\.integration\.test\.ts$/);
    expect(integrationFiles.length).toBeGreaterThan(0);

    const violations: { file: string; rule: string; line: number }[] = [];

    for (const file of integrationFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split(/\r?\n/);

      lines.forEach((line, index) => {
        // Ignorar comentarios
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          return;
        }

        if (/\bsleep\s*\(/.test(line)) {
          violations.push({ file: path.basename(file), rule: 'sleep()', line: index + 1 });
        }
        if (/\bsetTimeout\s*\(/.test(line)) {
          violations.push({ file: path.basename(file), rule: 'setTimeout()', line: index + 1 });
        }
        if (/\.skip\s*\(/.test(line)) {
          violations.push({ file: path.basename(file), rule: '.skip', line: index + 1 });
        }
        if (/\.only\s*\(/.test(line)) {
          violations.push({ file: path.basename(file), rule: '.only', line: index + 1 });
        }
      });
    }

    expect(
      violations,
      `Se encontraron violaciones de higiene en pruebas de integración:\n${JSON.stringify(violations, null, 2)}`,
    ).toEqual([]);
  });

  it('ensures vitest integration project defines explicit testTimeout and hookTimeout', () => {
    const vitestConfigFile = path.resolve(backendRootDir, 'vitest.config.ts');
    const content = fs.readFileSync(vitestConfigFile, 'utf-8');

    // Verificar que el bloque de configuración del proyecto 'integration' defina testTimeout y hookTimeout
    expect(content).toMatch(/name:\s*'integration'/);
    expect(content).toMatch(/testTimeout:\s*30_?000/);
    expect(content).toMatch(/hookTimeout:\s*60_?000/);
  });

  it('ensures prepareTestDatabase specifies explicit timeout in execSync and connectionTimeoutMillis', () => {
    const prepareDbFile = path.resolve(backendSrcDir, 'test/db/prepare-test-database.ts');
    const content = fs.readFileSync(prepareDbFile, 'utf-8');

    expect(content).toMatch(/connectionTimeoutMillis:\s*10_?000/);
    expect(content).toMatch(/timeout:\s*120_?000/);
  });
});
