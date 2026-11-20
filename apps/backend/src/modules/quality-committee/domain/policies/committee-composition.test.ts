import { describe, expect, it } from 'vitest';
import { InvalidQualityCommitteeDataError } from '../errors/invalid-quality-committee-data-error.js';
import { QualityCommitteeClosedError } from '../errors/quality-committee-closed-error.js';
import { QualityCommitteeOverlapError } from '../errors/quality-committee-overlap-error.js';
import {
  assertCommitteeComposition,
  assertCommitteeEditable,
  assertNoOverlap,
  COMMITTEE_MEMBER_DEGREE_MAX_LENGTH,
  COMMITTEE_MEMBER_NAME_MAX_LENGTH,
  COMMITTEE_MEMBERS_MAX,
} from './committee-composition.js';

describe('committee-composition', () => {
  it('requires exactly one president', () => {
    expect(() =>
      assertCommitteeComposition({
        members: [{ fullName: 'Ana Torres', degree: 'Mg.', position: 'MEMBER' }],
      }),
    ).toThrow(InvalidQualityCommitteeDataError);

    expect(() =>
      assertCommitteeComposition({
        members: [
          { fullName: 'Ana Torres', degree: 'Mg.', position: 'PRESIDENT' },
          { fullName: 'Luis Rojas', degree: 'Dr.', position: 'PRESIDENT' },
        ],
      }),
    ).toThrow(InvalidQualityCommitteeDataError);

    expect(() => assertCommitteeComposition({ members: [] })).toThrow(
      InvalidQualityCommitteeDataError,
    );
  });

  it('rejects more than 30 members', () => {
    const members = [
      { fullName: 'Presidente Uno', degree: 'Dr.', position: 'PRESIDENT' as const },
      ...Array.from({ length: COMMITTEE_MEMBERS_MAX }, (_, idx) => ({
        fullName: `Miembro ${idx + 1}`,
        degree: 'Ing.',
        position: 'MEMBER' as const,
      })),
    ];

    expect(() => assertCommitteeComposition({ members })).toThrow(InvalidQualityCommitteeDataError);
  });

  it('links a member to an active user', () => {
    const result = assertCommitteeComposition({
      members: [
        { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' },
        { fullName: 'Luis Rojas', degree: 'Mg.', position: 'MEMBER', userId: 'usr-2' },
      ],
    });

    expect(result).toEqual([
      { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' },
      { fullName: 'Luis Rojas', degree: 'Mg.', position: 'MEMBER', userId: 'usr-2' },
    ]);
  });

  it('rejects a user linked twice', () => {
    expect(() =>
      assertCommitteeComposition({
        members: [
          { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: 'usr-1' },
          { fullName: 'Luis Rojas', degree: 'Mg.', position: 'MEMBER', userId: 'usr-1' },
        ],
      }),
    ).toThrow(InvalidQualityCommitteeDataError);
  });

  it('accepts members without an account', () => {
    const result = assertCommitteeComposition({
      members: [
        { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: null },
        { fullName: 'Luis Rojas', degree: 'Mg.', position: 'MEMBER' },
        { fullName: 'Rosa Vega', degree: 'Ing.', position: 'MEMBER', userId: '   ' },
      ],
    });

    expect(result.map((member) => member.userId)).toEqual([null, null, null]);
  });

  it('trims names and degree and rejects empty or oversized values', () => {
    const result = assertCommitteeComposition({
      members: [{ fullName: '  Ana Torres  ', degree: '  Dr.  ', position: 'PRESIDENT' }],
    });

    expect(result).toEqual([
      { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT', userId: null },
    ]);

    expect(() =>
      assertCommitteeComposition({
        members: [{ fullName: '   ', degree: 'Dr.', position: 'PRESIDENT' }],
      }),
    ).toThrow(InvalidQualityCommitteeDataError);

    expect(() =>
      assertCommitteeComposition({
        members: [
          {
            fullName: 'A'.repeat(COMMITTEE_MEMBER_NAME_MAX_LENGTH + 1),
            degree: 'Dr.',
            position: 'PRESIDENT',
          },
        ],
      }),
    ).toThrow(InvalidQualityCommitteeDataError);

    expect(() =>
      assertCommitteeComposition({
        members: [{ fullName: 'Ana Torres', degree: '  ', position: 'PRESIDENT' }],
      }),
    ).toThrow(InvalidQualityCommitteeDataError);

    expect(() =>
      assertCommitteeComposition({
        members: [
          {
            fullName: 'Ana Torres',
            degree: 'D'.repeat(COMMITTEE_MEMBER_DEGREE_MAX_LENGTH + 1),
            position: 'PRESIDENT',
          },
        ],
      }),
    ).toThrow(InvalidQualityCommitteeDataError);
  });

  it('rejects a period that overlaps another committee', () => {
    const existing = [{ periodStart: '2027-01-01', periodEnd: '2027-12-31' }];

    expect(() =>
      assertNoOverlap({
        period: { periodStart: '2027-06-01', periodEnd: '2028-05-31' },
        existing,
      }),
    ).toThrow(QualityCommitteeOverlapError);

    expect(() =>
      assertNoOverlap({
        period: { periodStart: '2028-01-01', periodEnd: '2028-12-31' },
        existing,
      }),
    ).not.toThrow();
  });

  it('rejects editing a finished committee', () => {
    const period = { periodStart: '2026-01-01', periodEnd: '2026-12-31' };

    expect(() => assertCommitteeEditable({ period, today: '2027-01-01' })).toThrow(
      QualityCommitteeClosedError,
    );

    expect(() => assertCommitteeEditable({ period, today: '2026-12-31' })).not.toThrow();
    expect(() => assertCommitteeEditable({ period, today: '2025-12-31' })).not.toThrow();
  });
});
