import { describe, expect, it } from 'vitest';
import { InvalidStakeholderListDataError } from '../errors/invalid-stakeholder-list-data-error.js';
import { StakeholderList } from './stakeholder-list.js';

const NOW = new Date('2026-11-16T10:00:00.000Z');

describe('StakeholderList', () => {
  it('rejects a year out of range', () => {
    expect(() =>
      StakeholderList.create({
        id: 'list-1',
        programId: 'prog-1',
        type: 'EMPLOYER',
        year: 1999,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidStakeholderListDataError);

    expect(() =>
      StakeholderList.create({
        id: 'list-2',
        programId: 'prog-1',
        type: 'EMPLOYER',
        year: 2101,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidStakeholderListDataError);
  });

  it('normalizes empty header fields to null', () => {
    const list = StakeholderList.create({
      id: 'list-1',
      programId: 'prog-1',
      type: 'EMPLOYER',
      year: 2027,
      studyPlanNumber: '   ',
      version: '',
      actorId: 'user-1',
      now: NOW,
    });

    expect(list.studyPlanNumber).toBeNull();
    expect(list.version).toBeNull();
    expect(list.snapshot()).toEqual({
      programId: 'prog-1',
      type: 'EMPLOYER',
      year: 2027,
      studyPlanNumber: null,
      version: null,
    });
  });

  it('rejects header fields longer than 20 characters', () => {
    expect(() =>
      StakeholderList.create({
        id: 'list-1',
        programId: 'prog-1',
        type: 'GRADUATE',
        year: 2027,
        studyPlanNumber: '123456789012345678901',
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidStakeholderListDataError);
  });
});
