import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_VERSION } from './app-version';

describe('APP_VERSION', () => {
  it('matches the version of apps/frontend/package.json', () => {
    const pkgPath = path.resolve(import.meta.dirname, '../../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
  });
});
