import { describe, expect, it } from 'vitest';
import {
  InvalidResolutionDataError,
  InvalidResolutionTransitionError,
  ResolutionPdfRequiredError,
  ResolutionTypeNotAvailableError,
} from '../errors/index.js';
import { Resolution, type ResolutionPdf } from './resolution.js';

const NOW = new Date('2026-11-13T12:00:00.000Z');
const ISSUED_ON = new Date('2026-11-10T00:00:00.000Z');

const PDF: ResolutionPdf = {
  fileId: 'file-1',
  provider: 'memory',
  publicId: 'resolutions/r1',
  url: 'https://files.example.test/r1.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  sha256: 'a'.repeat(64),
};

function register(overrides: Partial<Parameters<typeof Resolution.register>[0]> = {}) {
  return Resolution.register({
    id: 'r1',
    type: 'EDUCATIONAL_OBJECTIVE',
    number: 'RD-012/2027',
    issuedOn: ISSUED_ON,
    catalogVersionId: 'v1',
    actorId: 'user-1',
    now: NOW,
    ...overrides,
  });
}

describe('Resolution', () => {
  it('registers a resolution linked to a catalog version', () => {
    const resolution = register();
    expect(resolution.status).toBe('REGISTERED');
    expect(resolution.catalogVersionId).toBe('v1');
    expect(resolution.pdfFileId).toBeNull();
    expect(resolution.approvedAt).toBeNull();
    expect(resolution.approvedBy).toBeNull();
    expect(resolution.createdBy).toBe('user-1');
    expect(resolution.snapshot()).toEqual({
      type: 'EDUCATIONAL_OBJECTIVE',
      number: 'RD-012/2027',
      issuedOn: '2026-11-10',
      status: 'REGISTERED',
      catalogVersionId: 'v1',
    });
  });

  it('accepts a graduate attribute resolution', () => {
    expect(register({ type: 'GRADUATE_ATTRIBUTE' }).type).toBe('GRADUATE_ATTRIBUTE');
  });

  it('trims the number before storing it', () => {
    expect(register({ number: '  RD-1  ' }).number).toBe('RD-1');
  });

  it('rejects an improvement plan resolution until the plan exists', () => {
    expect(() => register({ type: 'IMPROVEMENT_PLAN', catalogVersionId: null })).toThrow(
      ResolutionTypeNotAvailableError,
    );
  });

  it('rejects an unknown type', () => {
    expect(() => register({ type: 'OTHER' as never })).toThrow(InvalidResolutionDataError);
  });

  it.each(['', '   ', 'x'.repeat(41), 'RD#1', 'RD<1>', 'RD\n1'])(
    'rejects the number %j',
    (number) => {
      expect(() => register({ number })).toThrow(InvalidResolutionDataError);
    },
  );

  it('accepts a number of exactly 40 characters', () => {
    expect(register({ number: 'R'.repeat(40) }).number).toHaveLength(40);
  });

  it('rejects an invalid date', () => {
    expect(() => register({ issuedOn: new Date('invalid') })).toThrow(InvalidResolutionDataError);
  });

  it.each([null, '', '  '])('requires a catalog version (%j)', (catalogVersionId) => {
    expect(() => register({ catalogVersionId })).toThrow(InvalidResolutionDataError);
  });

  describe('approve (RN-063, RS 5.8)', () => {
    const APPROVAL = new Date('2026-11-14T09:00:00.000Z');

    it('approves a registered resolution with the signed pdf and emits the event', () => {
      const registered = register();
      const { resolution, event } = registered.approve({
        pdf: PDF,
        actorId: 'user-2',
        now: APPROVAL,
      });
      expect(resolution.status).toBe('APPROVED');
      expect(resolution.pdfFileId).toBe('file-1');
      expect(resolution.approvedBy).toBe('user-2');
      expect(resolution.approvedAt).toEqual(APPROVAL);
      expect(event).toEqual({
        resolutionId: 'r1',
        type: 'EDUCATIONAL_OBJECTIVE',
        catalogVersionId: 'v1',
        approvedBy: 'user-2',
        approvedAt: APPROVAL,
      });
    });

    it('does not mutate the original resolution', () => {
      const registered = register();
      registered.approve({ pdf: PDF, actorId: 'user-2', now: APPROVAL });
      expect(registered.status).toBe('REGISTERED');
      expect(registered.pdfFileId).toBeNull();
    });

    it('requires the signed pdf', () => {
      expect(() => register().approve({ pdf: null, actorId: 'user-2' })).toThrow(
        ResolutionPdfRequiredError,
      );
    });

    it('rejects approving an already approved resolution', () => {
      const { resolution } = register().approve({ pdf: PDF, actorId: 'user-2', now: APPROVAL });
      expect(() => resolution.approve({ pdf: PDF, actorId: 'user-3' })).toThrow(
        InvalidResolutionTransitionError,
      );
    });
  });

  it('rejects an unknown status when rebuilding a persisted resolution', () => {
    expect(() =>
      Resolution.create({
        id: 'r1',
        type: 'EDUCATIONAL_OBJECTIVE',
        number: 'RD-1',
        issuedOn: ISSUED_ON,
        status: 'ARCHIVED' as never,
        catalogVersionId: 'v1',
        pdfFileId: null,
        approvedAt: null,
        approvedBy: null,
        createdBy: 'user-1',
        createdAt: NOW,
        updatedAt: NOW,
      }),
    ).toThrow(InvalidResolutionDataError);
  });

  it('rebuilds an improvement plan resolution from persistence without a version', () => {
    const resolution = Resolution.create({
      id: 'r2',
      type: 'IMPROVEMENT_PLAN',
      number: 'RD-2',
      issuedOn: ISSUED_ON,
      status: 'REGISTERED',
      catalogVersionId: null,
      pdfFileId: null,
      approvedAt: null,
      approvedBy: null,
      createdBy: 'user-1',
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(resolution.catalogVersionId).toBeNull();
  });
});
