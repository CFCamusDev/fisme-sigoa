import { describe, expect, it } from 'vitest';
import { OFFICIAL_LOGO_DATA_URI } from '../../../../shared/branding/official-logo-data-uri.js';
import { InstitutionalAnnexDataProvider } from './institutional-annex-data-provider.js';

describe('InstitutionalAnnexDataProvider (T-070-02)', () => {
  it('supports every annex and supplies the embedded official logo', async () => {
    const provider = new InstitutionalAnnexDataProvider();

    expect(provider.supports('FO-01')).toBe(true);
    expect(provider.supports('FO-11')).toBe(true);

    const data = await provider.provide({
      annexCode: 'FO-01',
      generatedAt: new Date('2026-11-20T15:00:00.000Z'),
    });

    expect(data.scalars).toEqual({
      'logo.url': OFFICIAL_LOGO_DATA_URI,
    });
  });
});
