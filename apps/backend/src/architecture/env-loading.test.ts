import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendSrcDir = path.resolve(__dirname, '..');

function findTsSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'coverage') {
        results.push(...findTsSourceFiles(fullPath));
      }
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.spec.ts')
    ) {
      results.push(fullPath);
    }
  }

  return results;
}

describe('Environment loading architecture rules (T-004-18, AGENTS §9)', () => {
  it('only entry points call loadEnvFileIfPresent', () => {
    const sourceFiles = findTsSourceFiles(backendSrcDir);
    expect(sourceFiles.length).toBeGreaterThan(0);

    const allowedFiles = new Set([
      path.normalize(path.join(backendSrcDir, 'config', 'load-env-file.ts')),
      path.normalize(path.join(backendSrcDir, 'server.ts')),
      path.normalize(path.join(backendSrcDir, 'seed.ts')),
      path.normalize(path.join(backendSrcDir, 'provision-app-role.ts')),
      path.normalize(path.join(backendSrcDir, 'smoke-adapters.ts')),
    ]);

    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of sourceFiles) {
      const normalizedPath = path.normalize(file);
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split(/\r?\n/);

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
          return;
        }

        // Llamada a la función (excluye declaraciones import o export)
        if (/\bloadEnvFileIfPresent\s*\(/.test(line) && !/import\s+/.test(line)) {
          if (!allowedFiles.has(normalizedPath)) {
            violations.push({
              file: path.relative(backendSrcDir, file).replace(/\\/g, '/'),
              line: index + 1,
              text: trimmed,
            });
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('smoke-adapters only loads the env inside the direct execution block', () => {
    const smokeAdaptersFile = path.join(backendSrcDir, 'smoke-adapters.ts');
    expect(fs.existsSync(smokeAdaptersFile)).toBe(true);

    const content = fs.readFileSync(smokeAdaptersFile, 'utf-8');
    const lines = content.split(/\r?\n/);

    const topLevelCalls: { line: number; text: string }[] = [];

    lines.forEach((line, index) => {
      // Ignorar líneas comentadas o imports
      if (line.trim().startsWith('//') || /import\s+/.test(line)) {
        return;
      }

      if (/\bloadEnvFileIfPresent\s*\(/.test(line)) {
        // Si no tiene indentación al inicio, es una llamada de nivel superior
        if (!/^\s+/.test(line)) {
          topLevelCalls.push({
            line: index + 1,
            text: line,
          });
        }
      }
    });

    expect(topLevelCalls).toEqual([]);
  });
});
