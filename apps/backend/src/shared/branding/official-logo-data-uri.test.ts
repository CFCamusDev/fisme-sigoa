import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { OFFICIAL_LOGO_DATA_URI } from './official-logo-data-uri.js';

const DATA_URI_PREFIX = 'data:image/png;base64,';

describe('OFFICIAL_LOGO_DATA_URI (T-070-02)', () => {
  it('matches the public logo file byte for byte', () => {
    expect(OFFICIAL_LOGO_DATA_URI.startsWith(DATA_URI_PREFIX)).toBe(true);

    const decoded = Buffer.from(OFFICIAL_LOGO_DATA_URI.slice(DATA_URI_PREFIX.length), 'base64');
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const publicLogoPath = resolve(
      currentDir,
      '../../../../frontend/public/assets/logo-untrm-v1-256.png',
    );
    const publicLogo = readFileSync(publicLogoPath);

    const decodedHash = createHash('sha256').update(decoded).digest('hex');
    const publicHash = createHash('sha256').update(publicLogo).digest('hex');

    expect(decodedHash).toBe(publicHash);
    expect(decoded.equals(publicLogo)).toBe(true);
  });
});
