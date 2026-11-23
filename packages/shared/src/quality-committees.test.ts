import { describe, expect, it } from 'vitest';
import {
  COMMITTEE_LIST_PAGE_SIZE_MAX,
  COMMITTEE_MEMBER_NAME_MAX_LENGTH,
  COMMITTEE_MEMBERS_MAX,
  currentQualityCommitteeResponseSchema,
  qualityCommitteeIdParamSchema,
  qualityCommitteeListQuerySchema,
  qualityCommitteeListResponseSchema,
  registerQualityCommitteeRequestSchema,
  replaceCommitteeMembersRequestSchema,
} from './quality-committees.js';

describe('quality-committees schemas', () => {
  it('accepts a valid registration', () => {
    const parsed = registerQualityCommitteeRequestSchema.parse({
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      members: [
        {
          fullName: '  Ana Torres  ',
          degree: '  Dr.  ',
          position: 'PRESIDENT',
          userEmail: '  ANA.TORRES@example.test  ',
        },
        {
          fullName: 'Luis Rojas',
          degree: 'Mg.',
          position: 'MEMBER',
          userId: '   ',
          userEmail: '',
        },
      ],
    });

    expect(parsed.periodStart).toBe('2027-01-01');
    expect(parsed.periodEnd).toBe('2027-12-31');
    expect(parsed.members[0]).toEqual({
      fullName: 'Ana Torres',
      degree: 'Dr.',
      position: 'PRESIDENT',
      userEmail: 'ana.torres@example.test',
    });
    expect(parsed.members[1]).toEqual({
      fullName: 'Luis Rojas',
      degree: 'Mg.',
      position: 'MEMBER',
      userId: null,
      userEmail: null,
    });
  });

  it('rejects unknown fields', () => {
    const result = registerQualityCommitteeRequestSchema.safeParse({
      periodStart: '2027-01-01',
      periodEnd: '2027-12-31',
      extra: true,
      members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects both userId and userEmail', () => {
    const result = replaceCommitteeMembersRequestSchema.safeParse({
      members: [
        {
          fullName: 'Ana Torres',
          degree: 'Dr.',
          position: 'PRESIDENT',
          userId: 'usr-1',
          userEmail: 'ana.torres@example.test',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects two presidents', () => {
    const result = replaceCommitteeMembersRequestSchema.safeParse({
      members: [
        { fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' },
        { fullName: 'Luis Rojas', degree: 'Mg.', position: 'PRESIDENT' },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an inverted period', () => {
    const result = registerQualityCommitteeRequestSchema.safeParse({
      periodStart: '2027-12-31',
      periodEnd: '2027-01-01',
      members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }],
    });

    expect(result.success).toBe(false);
  });

  it('reports empty start date, end date and non-calendar days with clear messages', () => {
    const emptyDates = registerQualityCommitteeRequestSchema.safeParse({
      periodStart: '',
      periodEnd: '',
      members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }],
    });
    expect(emptyDates.success).toBe(false);
    if (!emptyDates.success) {
      expect(emptyDates.error.issues.find((i) => i.path[0] === 'periodStart')?.message).toBe(
        'Indica la fecha de inicio',
      );
      expect(emptyDates.error.issues.find((i) => i.path[0] === 'periodEnd')?.message).toBe(
        'Indica la fecha de fin',
      );
    }

    const brokenFormat = registerQualityCommitteeRequestSchema.safeParse({
      periodStart: '01/01/2027',
      periodEnd: '2027-02-30',
      members: [{ fullName: 'Ana Torres', degree: 'Dr.', position: 'PRESIDENT' }],
    });
    expect(brokenFormat.success).toBe(false);
    if (!brokenFormat.success) {
      expect(brokenFormat.error.issues.find((i) => i.path[0] === 'periodStart')?.message).toBe(
        'La fecha de inicio no es válida. Elígela en el calendario',
      );
      expect(brokenFormat.error.issues.find((i) => i.path[0] === 'periodEnd')?.message).toContain(
        'día válido',
      );
    }
  });

  it('rejects more than 30 members', () => {
    const members = [
      { fullName: 'Presidente', degree: 'Dr.', position: 'PRESIDENT' as const },
      ...Array.from({ length: COMMITTEE_MEMBERS_MAX }, (_, index) => ({
        fullName: `Miembro ${index + 1}`,
        degree: 'Ing.',
        position: 'MEMBER' as const,
      })),
    ];

    const result = replaceCommitteeMembersRequestSchema.safeParse({ members });
    expect(result.success).toBe(false);
  });

  it('rejects a name over 160 characters', () => {
    const result = replaceCommitteeMembersRequestSchema.safeParse({
      members: [
        {
          fullName: 'A'.repeat(COMMITTEE_MEMBER_NAME_MAX_LENGTH + 1),
          degree: 'Dr.',
          position: 'PRESIDENT',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an out-of-range pageSize', () => {
    expect(
      qualityCommitteeListQuerySchema.safeParse({
        page: 1,
        pageSize: COMMITTEE_LIST_PAGE_SIZE_MAX + 1,
      }).success,
    ).toBe(false);

    expect(
      qualityCommitteeListQuerySchema.safeParse({
        page: 0,
        pageSize: 10,
      }).success,
    ).toBe(false);

    expect(qualityCommitteeListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
  });

  it('parses the current committee response with alerts and validates id params and list responses', () => {
    expect(qualityCommitteeIdParamSchema.parse({ id: 'com-2027' })).toEqual({ id: 'com-2027' });

    const parsed = currentQualityCommitteeResponseSchema.parse({
      committee: {
        id: 'com-2027',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        isCurrent: true,
        members: [
          {
            id: 'mem-1',
            fullName: 'Ana Torres',
            degree: 'Dr.',
            position: 'PRESIDENT',
            userId: 'usr-1',
            linkedUserName: 'Ana Torres Quispe',
          },
          {
            id: 'mem-2',
            fullName: 'Carlos Méndez',
            degree: 'Mg.',
            position: 'MEMBER',
            userId: null,
            linkedUserName: null,
          },
        ],
      },
      actorMembership: {
        memberId: 'mem-1',
        position: 'PRESIDENT',
      },
      alerts: [{ userId: 'usr-old', fullName: 'Pedro Salas' }],
    });

    expect(parsed.committee?.id).toBe('com-2027');
    expect(parsed.alerts).toHaveLength(1);

    const listParsed = qualityCommitteeListResponseSchema.parse({
      items: parsed.committee ? [parsed.committee] : [],
      page: 1,
      pageSize: 10,
      total: 1,
    });
    expect(listParsed.total).toBe(1);
  });
});
