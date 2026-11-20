import { describe, expect, it } from 'vitest';
import { InvalidTemplateDataError } from '../errors/invalid-template-data-error.js';
import { OfficialDownloadRecord } from './official-download-record.js';

const VALID_SHA256 = 'a'.repeat(64);
const GENERATED_AT = new Date('2026-11-20T15:00:00.000Z');

describe('OfficialDownloadRecord (T-070-08)', () => {
  it('builds the audit payload without storing the pdf', () => {
    const record = OfficialDownloadRecord.create({
      templateId: 'tpl-1',
      templateCode: 'FO-01',
      versionId: 'ver-3',
      versionNumber: 3,
      pdfSha256: VALID_SHA256.toUpperCase(),
      pdfBytes: 42_500,
      generatedAt: GENERATED_AT,
    });

    const payload = record.toAuditPayload();

    expect(payload).toEqual({
      templateId: 'tpl-1',
      templateCode: 'FO-01',
      versionId: 'ver-3',
      versionNumber: 3,
      pdfSha256: VALID_SHA256,
      pdfBytes: 42_500,
      generatedAt: '2026-11-20T15:00:00.000Z',
    });
    expect(Object.keys(payload)).not.toContain('pdf');
    expect(Object.keys(payload)).not.toContain('html');
  });

  it('rejects an empty code, a version below one and a malformed hash', () => {
    expect(() =>
      OfficialDownloadRecord.create({
        templateId: 'tpl-1',
        templateCode: '   ',
        versionId: 'ver-1',
        versionNumber: 1,
        pdfSha256: VALID_SHA256,
        pdfBytes: 1024,
        generatedAt: GENERATED_AT,
      }),
    ).toThrow(InvalidTemplateDataError);

    expect(() =>
      OfficialDownloadRecord.create({
        templateId: 'tpl-1',
        templateCode: 'FO-01',
        versionId: 'ver-1',
        versionNumber: 0,
        pdfSha256: VALID_SHA256,
        pdfBytes: 1024,
        generatedAt: GENERATED_AT,
      }),
    ).toThrow(InvalidTemplateDataError);

    expect(() =>
      OfficialDownloadRecord.create({
        templateId: 'tpl-1',
        templateCode: 'FO-01',
        versionId: 'ver-1',
        versionNumber: 1,
        pdfSha256: 'not-a-sha256',
        pdfBytes: 1024,
        generatedAt: GENERATED_AT,
      }),
    ).toThrow(InvalidTemplateDataError);

    expect(() =>
      OfficialDownloadRecord.create({
        templateId: 'tpl-1',
        templateCode: 'FO-01',
        versionId: 'ver-1',
        versionNumber: 1,
        pdfSha256: VALID_SHA256,
        pdfBytes: 0,
        generatedAt: GENERATED_AT,
      }),
    ).toThrow(InvalidTemplateDataError);
  });
});
