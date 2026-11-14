import { describe, expect, it } from 'vitest';
import { RESOLUTION_STATUSES } from '../entities/resolution-enums.js';
import { InvalidResolutionTransitionError, ResolutionPdfRequiredError } from '../errors/index.js';
import { assertTransition, canTransition, requiredPermission } from './resolution-state-machine.js';

describe('resolution state machine (RS 5.8)', () => {
  it('allows only registered to approved', () => {
    const allowed = RESOLUTION_STATUSES.flatMap((from) =>
      RESOLUTION_STATUSES.filter((to) => canTransition(from, to)).map((to) => `${from}>${to}`),
    );
    expect(allowed).toEqual(['REGISTERED>APPROVED']);
  });

  it('requires the approve permission for the only transition', () => {
    expect(requiredPermission('REGISTERED', 'APPROVED')).toBe('resolucion.aprobar');
  });

  it.each([
    ['APPROVED', 'REGISTERED'],
    ['APPROVED', 'APPROVED'],
    ['REGISTERED', 'REGISTERED'],
  ] as const)('rejects %s to %s', (from, to) => {
    expect(() => requiredPermission(from, to)).toThrow(InvalidResolutionTransitionError);
    expect(() => assertTransition({ from, to, hasSignedPdf: true })).toThrow(
      InvalidResolutionTransitionError,
    );
  });

  it('requires the signed pdf to approve', () => {
    expect(() =>
      assertTransition({ from: 'REGISTERED', to: 'APPROVED', hasSignedPdf: false }),
    ).toThrow(ResolutionPdfRequiredError);
  });

  it('accepts the transition with the signed pdf', () => {
    expect(() =>
      assertTransition({ from: 'REGISTERED', to: 'APPROVED', hasSignedPdf: true }),
    ).not.toThrow();
  });

  it('tells that an approved resolution cannot change', () => {
    expect(() =>
      assertTransition({ from: 'APPROVED', to: 'APPROVED', hasSignedPdf: true }),
    ).toThrow('ya está aprobada');
  });
});
