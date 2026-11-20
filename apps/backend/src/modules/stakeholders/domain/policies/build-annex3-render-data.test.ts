import { describe, expect, it } from 'vitest';
import { StakeholderList } from '../entities/stakeholder-list.js';
import type { StakeholderListType } from '../entities/stakeholder-list-enums.js';
import {
  StakeholderListMember,
  type StakeholderListMemberProperties,
} from '../entities/stakeholder-list-member.js';
import { ANNEX3_MISSING_VALUE, buildAnnex3RenderData } from './build-annex3-render-data.js';

const NOW = new Date('2026-11-20T10:00:00.000Z');

function makeList(
  type: StakeholderListType,
  overrides: Partial<{ id: string; studyPlanNumber: string | null; version: string | null }> = {},
): StakeholderList {
  return StakeholderList.reconstitute({
    id: overrides.id ?? `list-${type.toLowerCase()}`,
    programId: 'prog-1',
    type,
    year: 2026,
    studyPlanNumber: overrides.studyPlanNumber === undefined ? '2024' : overrides.studyPlanNumber,
    version: overrides.version === undefined ? 'v1' : overrides.version,
    createdBy: 'user-1',
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function makeMember(
  listId: string,
  overrides: Partial<StakeholderListMemberProperties> = {},
): StakeholderListMember {
  return StakeholderListMember.reconstitute({
    id: overrides.id ?? `mem-${listId}`,
    listId,
    stakeholderId: overrides.stakeholderId ?? 'stk-1',
    fullName: overrides.fullName ?? 'Persona Ejemplo',
    institution: overrides.institution ?? null,
    ruc: overrides.ruc ?? null,
    sector: overrides.sector ?? null,
    representative: overrides.representative ?? null,
    activity: overrides.activity ?? null,
    email: overrides.email ?? null,
    mobile: overrides.mobile ?? null,
    position: overrides.position ?? null,
    graduationYear: overrides.graduationYear ?? null,
    cycle: overrides.cycle ?? null,
    createdBy: 'user-1',
    createdAt: NOW,
  });
}

describe('buildAnnex3RenderData (T-026-01)', () => {
  it('maps each list type to its section and shows a dash for missing values', () => {
    const requestedList = makeList('EMPLOYER', {
      studyPlanNumber: null,
      version: null,
    });

    const advisoryList = makeList('ADVISORY_BOARD');
    const graduateList = makeList('GRADUATE');
    const studentList = makeList('STUDENT');
    const teacherList = makeList('TEACHER');

    const result = buildAnnex3RenderData(requestedList, [
      {
        list: advisoryList,
        members: [
          makeMember(advisoryList.id, {
            activity: 'Revisión curricular',
            institution: 'Empresa Norte',
            email: null,
            mobile: '999888777',
          }),
        ],
      },
      {
        list: requestedList,
        members: [
          makeMember(requestedList.id, {
            institution: 'Tech Andes SAC',
            ruc: '20123456789',
            sector: 'Software',
            representative: 'Ana Pérez',
            email: 'contacto@techandes.test',
            mobile: null,
            position: 'Gerente TI',
          }),
        ],
      },
      {
        list: graduateList,
        members: [
          makeMember(graduateList.id, {
            fullName: 'Carlos Rojas',
            graduationYear: 2023,
            email: 'carlos@correo.test',
            mobile: '988777666',
          }),
        ],
      },
      {
        list: studentList,
        members: [
          makeMember(studentList.id, {
            fullName: 'Lucía Díaz',
            cycle: 'IX',
            email: null,
            mobile: null,
          }),
        ],
      },
      {
        list: teacherList,
        members: [
          makeMember(teacherList.id, {
            fullName: 'Docente Uno',
            email: 'docente@untrm.test',
            mobile: '977666555',
          }),
        ],
      },
    ]);

    expect(result.scalars).toEqual({
      'studyPlan.number': ANNEX3_MISSING_VALUE,
      'studyPlan.year': '2026',
      'list.version': ANNEX3_MISSING_VALUE,
    });

    expect(result.collections.advisory).toEqual([
      {
        activity: 'Revisión curricular',
        institution: 'Empresa Norte',
        email: ANNEX3_MISSING_VALUE,
        phone: '999888777',
      },
    ]);
    expect(result.collections.employers).toEqual([
      {
        institution: 'Tech Andes SAC',
        ruc: '20123456789',
        sector: 'Software',
        legalRepresentative: 'Ana Pérez',
        email: 'contacto@techandes.test',
        phone: ANNEX3_MISSING_VALUE,
        position: 'Gerente TI',
      },
    ]);
    expect(result.collections.graduates).toEqual([
      {
        name: 'Carlos Rojas',
        graduationYear: '2023',
        email: 'carlos@correo.test',
        contact: '988777666',
      },
    ]);
    expect(result.collections.students).toEqual([
      {
        name: 'Lucía Díaz',
        cycle: 'IX',
        email: ANNEX3_MISSING_VALUE,
        contact: ANNEX3_MISSING_VALUE,
      },
    ]);
    expect(result.collections.teachers).toEqual([
      {
        name: 'Docente Uno',
        email: 'docente@untrm.test',
        contact: '977666555',
      },
    ]);
  });

  it('returns empty collections when the year lists have no members', () => {
    const requestedList = makeList('TEACHER', { studyPlanNumber: '03', version: 'v2' });
    const result = buildAnnex3RenderData(requestedList, [{ list: requestedList, members: [] }]);

    expect(result.scalars).toEqual({
      'studyPlan.number': '03',
      'studyPlan.year': '2026',
      'list.version': 'v2',
    });
    expect(result.collections).toEqual({
      advisory: [],
      employers: [],
      graduates: [],
      students: [],
      teachers: [],
    });
  });
});
