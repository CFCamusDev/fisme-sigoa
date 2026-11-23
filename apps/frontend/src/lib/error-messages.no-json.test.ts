import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error';

const helperModules = import.meta.glob<Record<string, unknown>>(
  '../features/*/lib/*-error-message.ts',
  { eager: true },
);

describe('feature error helpers (HU-081, T-081-30)', () => {
  it('never returns raw validator JSON', () => {
    const rawJson = JSON.stringify([
      {
        code: 'invalid_string',
        path: ['dni'],
        message: 'El DNI debe contener exactamente 8 dígitos numéricos',
      },
    ]);

    const errors = [
      new ApiError({ code: 'VALIDATION_ERROR', status: 400, message: rawJson }),
      new ApiError({ code: 'CONFLICT', status: 409, message: rawJson }),
      new ApiError({ code: 'INTERNAL_ERROR', status: 500, message: rawJson }),
    ];

    const entries = Object.entries(helperModules);
    expect(entries.length).toBeGreaterThanOrEqual(20);

    for (const [filePath, exportsObj] of entries) {
      for (const [exportName, value] of Object.entries(exportsObj)) {
        if (typeof value !== 'function') continue;
        if (!exportName.startsWith('get') || !exportName.endsWith('ErrorMessage')) continue;

        for (const err of errors) {
          const out = (value as (input: unknown) => unknown)(err);
          expect(typeof out, `${filePath}#${exportName}`).toBe('string');
          const text = String(out).trim();
          expect(text.length, `${filePath}#${exportName} empty`).toBeGreaterThan(0);
          expect(text.startsWith('['), `${filePath}#${exportName} returned array JSON`).toBe(false);
          expect(text.startsWith('{'), `${filePath}#${exportName} returned object JSON`).toBe(
            false,
          );
          expect(text, `${filePath}#${exportName} leaked invalid_string`).not.toContain(
            'invalid_string',
          );
        }
      }
    }
  });
});
