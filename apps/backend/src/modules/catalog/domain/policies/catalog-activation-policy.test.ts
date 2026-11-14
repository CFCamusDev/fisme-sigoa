import { describe, expect, it } from 'vitest';
import { CatalogVersion, type CatalogVersionStatus } from '../entities/catalog-version.js';
import { InvalidCatalogTransitionError } from '../errors/index.js';
import { planActivation } from './catalog-activation-policy.js';

const NOW = new Date('2026-11-13T12:00:00.000Z');

function version(id: string, status: CatalogVersionStatus, programId = 'p1', number = 1) {
  return CatalogVersion.create({
    id,
    programId,
    number,
    status,
    basedOnVersionId: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('planActivation (RF-016)', () => {
  it('plans to demote the current version and activate the candidate', () => {
    const plan = planActivation({
      candidate: version('v2', 'IN_VALIDATION', 'p1', 2),
      current: version('v1', 'APPROVED'),
    });
    expect(plan).toEqual({ outcome: 'ACTIVATE', supersedeVersionId: 'v1' });
  });

  it('activates without demoting when there is no current version', () => {
    const plan = planActivation({
      candidate: version('v1', 'IN_VALIDATION'),
      current: null,
    });
    expect(plan).toEqual({ outcome: 'ACTIVATE', supersedeVersionId: null });
  });

  it('returns already current when the candidate is approved', () => {
    const candidate = version('v2', 'APPROVED', 'p1', 2);
    const plan = planActivation({ candidate, current: candidate });
    expect(plan).toEqual({ outcome: 'ALREADY_CURRENT' });
  });

  it.each<CatalogVersionStatus>(['DRAFT', 'HISTORICAL'])('rejects a %s candidate', (status) => {
    expect(() =>
      planActivation({ candidate: version('v2', status, 'p1', 2), current: null }),
    ).toThrow(InvalidCatalogTransitionError);
  });

  it('rejects a current version from another program', () => {
    expect(() =>
      planActivation({
        candidate: version('v2', 'IN_VALIDATION', 'p1', 2),
        current: version('x1', 'APPROVED', 'p2'),
      }),
    ).toThrow(InvalidCatalogTransitionError);
  });

  it('never leaves two current versions in the program', () => {
    const candidate = version('v2', 'IN_VALIDATION', 'p1', 2);
    const current = version('v1', 'APPROVED');
    const plan = planActivation({ candidate, current });
    if (plan.outcome !== 'ACTIVATE') throw new Error('expected an activation plan');

    // Se aplica el orden fijado por la política: primero la anterior, luego la candidata.
    const demoted =
      plan.supersedeVersionId === current.id ? current.supersede({ actorId: 'u' }) : current;
    const activated = candidate.activate({ actorId: 'u' });
    const all = [demoted, activated];

    expect(all.filter((item) => item.status === 'APPROVED')).toHaveLength(1);
    expect(demoted.status).toBe('HISTORICAL');
    expect(activated.status).toBe('APPROVED');
  });
});
