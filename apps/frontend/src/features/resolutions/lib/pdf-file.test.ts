import { describe, expect, it } from 'vitest';
import { formatFileSize, validateResolutionPdf } from './pdf-file';

const LIMIT = 10 * 1024 * 1024;

describe('validateResolutionPdf (T-048-15, CA3, D10)', () => {
  it('requires a file', () => {
    expect(validateResolutionPdf(null)).toMatch(/Selecciona el PDF firmado/);
    expect(validateResolutionPdf(undefined)).toMatch(/Selecciona el PDF firmado/);
  });

  it('rejects an empty file', () => {
    expect(validateResolutionPdf({ name: 'r.pdf', size: 0, type: 'application/pdf' })).toMatch(
      /vacío/,
    );
  });

  it.each([
    { name: 'r.png', size: 10, type: 'image/png' },
    { name: 'r.pdf', size: 10, type: 'text/plain' },
    { name: 'r.txt', size: 10, type: 'application/pdf' },
  ])('rejects the non-pdf file %j', (file) => {
    expect(validateResolutionPdf(file)).toMatch(/debe ser un PDF/);
  });

  it('accepts a pdf of exactly the limit and rejects one byte more', () => {
    expect(
      validateResolutionPdf({ name: 'R.PDF', size: LIMIT, type: 'application/pdf' }),
    ).toBeNull();
    expect(
      validateResolutionPdf({ name: 'r.pdf', size: LIMIT + 1, type: 'application/pdf' }),
    ).toMatch(/10 MB/);
  });
});

describe('formatFileSize', () => {
  it.each([
    [512, '512 B'],
    [2048, '2 KB'],
    [1.5 * 1024 * 1024, '1,5 MB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
