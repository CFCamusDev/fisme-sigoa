import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { copyWebBuildWithApiUrl, E2E_API_PLACEHOLDER } from '../e2e/support/e2e-web-copy';

describe('copyWebBuildWithApiUrl (HU-080, T-080-18)', () => {
  const tempDirs: string[] = [];

  function makeTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it('replaces the api placeholder in js and html files only', () => {
    const baseDir = makeTempDir('sigoa-web-base-');
    const targetDir = path.join(makeTempDir('sigoa-web-target-'), 'out');

    fs.mkdirSync(path.join(baseDir, 'assets'), { recursive: true });
    fs.writeFileSync(
      path.join(baseDir, 'index.html'),
      `<script>window.__API__="${E2E_API_PLACEHOLDER}";</script>`,
      'utf8',
    );
    fs.writeFileSync(
      path.join(baseDir, 'assets', 'index.js'),
      `const a="${E2E_API_PLACEHOLDER}";const b="${E2E_API_PLACEHOLDER}";`,
      'utf8',
    );
    fs.writeFileSync(
      path.join(baseDir, 'assets', 'styles.css'),
      `/* ${E2E_API_PLACEHOLDER} */ body { color: black; }`,
      'utf8',
    );

    copyWebBuildWithApiUrl(baseDir, targetDir, 'http://localhost:43210');

    expect(fs.readFileSync(path.join(targetDir, 'index.html'), 'utf8')).toBe(
      '<script>window.__API__="http://localhost:43210";</script>',
    );
    expect(fs.readFileSync(path.join(targetDir, 'assets', 'index.js'), 'utf8')).toBe(
      'const a="http://localhost:43210";const b="http://localhost:43210";',
    );
    expect(fs.readFileSync(path.join(targetDir, 'assets', 'styles.css'), 'utf8')).toBe(
      `/* ${E2E_API_PLACEHOLDER} */ body { color: black; }`,
    );
  });

  it('keeps non-text assets byte for byte', () => {
    const baseDir = makeTempDir('sigoa-web-bin-base-');
    const targetDir = path.join(makeTempDir('sigoa-web-bin-target-'), 'out');

    fs.mkdirSync(path.join(baseDir, 'assets'), { recursive: true });
    const binaryPayload = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from(E2E_API_PLACEHOLDER, 'utf8'),
      Buffer.from([0x00, 0xff, 0xfe]),
    ]);
    fs.writeFileSync(path.join(baseDir, 'assets', 'logo.png'), binaryPayload);

    copyWebBuildWithApiUrl(baseDir, targetDir, 'http://localhost:43210');

    const copied = fs.readFileSync(path.join(targetDir, 'assets', 'logo.png'));
    expect(copied.equals(binaryPayload)).toBe(true);
  });
});
