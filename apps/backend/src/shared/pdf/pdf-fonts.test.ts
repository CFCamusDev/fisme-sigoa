import { describe, expect, it } from 'vitest';
import { extractPdfFontNames } from './pdf-fonts.js';

describe('extractPdfFontNames helper', () => {
  it('extracts BaseFont and FontName stripping 6-letter subset prefixes', () => {
    const syntheticPdf = Buffer.from(
      `
      %PDF-1.4
      1 0 obj
      << /Type /Font /Subtype /TrueType /BaseFont /ABCDEF+OpenSans-Regular >>
      endobj
      2 0 obj
      << /Type /Font /FontName /UVWXYZ+OpenSans-Bold >>
      endobj
      3 0 obj
      << /Type /Font /BaseFont /LiberationSans >>
      endobj
      trailer
      << /Root 1 0 R >>
      %%EOF
      `,
      'latin1',
    );

    const fonts = extractPdfFontNames(syntheticPdf);

    expect(fonts).toContain('OpenSans-Regular');
    expect(fonts).toContain('OpenSans-Bold');
    expect(fonts).toContain('LiberationSans');
    expect(fonts.length).toBe(3);
  });

  it('returns empty array when no font descriptors are present', () => {
    const emptyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
    expect(extractPdfFontNames(emptyPdf)).toEqual([]);
  });

  it('decodes hex-escaped characters in PDF font names', () => {
    const escapedPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /BaseFont /ABCDEF+Open#20Sans >>\nendobj\n%%EOF',
      'latin1',
    );
    const fonts = extractPdfFontNames(escapedPdf);
    expect(fonts).toContain('Open Sans');
  });
});
