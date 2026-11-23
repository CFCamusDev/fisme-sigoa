import { describe, expect, it } from 'vitest';
import { EMPTY_PDF_HEADER_TEMPLATE, withEmptyPdfHeader } from './pdf-options.js';

describe('withEmptyPdfHeader (HU-081, T-081-27)', () => {
  it('adds an empty header template and keeps the footer', () => {
    const result = withEmptyPdfHeader({
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      footerTemplate: '<span>Pie oficial</span>',
    });

    expect(result).toEqual({
      format: 'A4',
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: EMPTY_PDF_HEADER_TEMPLATE,
      footerTemplate: '<span>Pie oficial</span>',
    });
  });

  it('preserves an explicit headerTemplate and leaves disabled header/footer untouched', () => {
    expect(
      withEmptyPdfHeader({
        displayHeaderFooter: true,
        headerTemplate: '<span>Custom</span>',
        footerTemplate: '<span>Pie</span>',
      }).headerTemplate,
    ).toBe('<span>Custom</span>');

    expect(withEmptyPdfHeader({ displayHeaderFooter: false })).toEqual({
      displayHeaderFooter: false,
    });
  });
});
