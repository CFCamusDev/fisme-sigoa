import { describe, expect, it } from 'vitest';
import { IncompleteListMemberError } from '../errors/incomplete-list-member-error.js';
import { InvalidStakeholderListDataError } from '../errors/invalid-stakeholder-list-data-error.js';
import { Stakeholder } from '../entities/stakeholder.js';
import { buildStakeholderListMemberSnapshot } from './stakeholder-list-type-fields.js';

const NOW = new Date('2026-11-16T10:00:00.000Z');

function createInstitution(
  overrides: Partial<Parameters<typeof Stakeholder.register>[0]> = {},
): Stakeholder {
  return Stakeholder.register({
    id: 'stk-inst-1',
    kind: 'INSTITUTION',
    fullName: 'Tech Amazonas SAC',
    ruc: '20123456789',
    sector: 'Tecnologia',
    position: 'Gerente General',
    email: 'contacto@techamazonas.pe',
    mobile: '987654321',
    actorId: 'user-1',
    now: NOW,
    ...overrides,
  });
}

function createPerson(
  overrides: Partial<Parameters<typeof Stakeholder.register>[0]> = {},
): Stakeholder {
  return Stakeholder.register({
    id: 'stk-per-1',
    kind: 'PERSON',
    fullName: 'Ana Lucia Torres',
    dni: '45678912',
    email: 'ana.torres@example.com',
    mobile: '987654322',
    position: 'Desarrolladora',
    institution: 'UNTRM',
    sector: 'Educacion',
    graduationYear: 2022,
    cycle: 'IX',
    actorId: 'user-1',
    now: NOW,
    ...overrides,
  });
}

describe('buildStakeholderListMemberSnapshot', () => {
  it('keeps institution, RUC, sector, representative, email, mobile and position for an employer', () => {
    const employer = createInstitution();

    const snapshot = buildStakeholderListMemberSnapshot('EMPLOYER', employer, {
      representative: '  Carlos Mendoza  ',
      activity: '  Desarrollo de software  ',
    });

    expect(snapshot).toEqual({
      fullName: 'Tech Amazonas SAC',
      institution: 'Tech Amazonas SAC',
      ruc: '20123456789',
      sector: 'Tecnologia',
      representative: 'Carlos Mendoza',
      activity: null,
      email: 'contacto@techamazonas.pe',
      mobile: '987654321',
      position: 'Gerente General',
      graduationYear: null,
      cycle: null,
    });
  });

  it('requires graduation year, email and mobile for a graduate', () => {
    const graduate = createPerson({ graduationYear: null, email: null, mobile: null });

    let caught: unknown;
    try {
      buildStakeholderListMemberSnapshot('GRADUATE', graduate);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(IncompleteListMemberError);
    expect((caught as IncompleteListMemberError).missingFields).toEqual([
      'año de egreso',
      'correo',
      'celular',
    ]);
  });

  it('requires cycle for a student', () => {
    const student = createPerson({ cycle: null });

    let caught: unknown;
    try {
      buildStakeholderListMemberSnapshot('STUDENT', student);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(IncompleteListMemberError);
    expect((caught as IncompleteListMemberError).missingFields).toEqual(['ciclo']);
  });

  it('requires only email and mobile for a teacher', () => {
    const teacher = createPerson({
      institution: null,
      sector: null,
      position: null,
      graduationYear: null,
      cycle: null,
    });

    const snapshot = buildStakeholderListMemberSnapshot('TEACHER', teacher);

    expect(snapshot).toEqual({
      fullName: 'Ana Lucia Torres',
      institution: null,
      ruc: null,
      sector: null,
      representative: null,
      activity: null,
      email: 'ana.torres@example.com',
      mobile: '987654322',
      position: null,
      graduationYear: null,
      cycle: null,
    });
  });

  it('rejects a person as an employer', () => {
    const person = createPerson();

    expect(() =>
      buildStakeholderListMemberSnapshot('EMPLOYER', person, {
        representative: 'Carlos Mendoza',
      }),
    ).toThrow(InvalidStakeholderListDataError);
  });

  it('does not copy fields that do not belong to the type', () => {
    const person = createPerson();

    const graduateSnapshot = buildStakeholderListMemberSnapshot('GRADUATE', person, {
      activity: 'Actividad que no aplica',
      representative: 'Representante que no aplica',
    });

    expect(graduateSnapshot).toEqual({
      fullName: 'Ana Lucia Torres',
      institution: null,
      ruc: null,
      sector: null,
      representative: null,
      activity: null,
      email: 'ana.torres@example.com',
      mobile: '987654322',
      position: null,
      graduationYear: 2022,
      cycle: null,
    });
  });

  it('lists every missing field in Spanish', () => {
    const institution = createInstitution({
      sector: null,
      position: null,
      email: null,
      mobile: null,
    });

    let caught: unknown;
    try {
      buildStakeholderListMemberSnapshot('EMPLOYER', institution);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(IncompleteListMemberError);
    expect((caught as IncompleteListMemberError).missingFields).toEqual([
      'sector',
      'representante',
      'correo',
      'celular',
      'cargo',
    ]);
  });

  it('supports both person and institution for advisory board and requires activity', () => {
    const person = createPerson();

    const snapshot = buildStakeholderListMemberSnapshot('ADVISORY_BOARD', person, {
      activity: '  Evaluacion curricular  ',
    });

    expect(snapshot.institution).toBe('UNTRM');
    expect(snapshot.activity).toBe('Evaluacion curricular');
    expect(snapshot.graduationYear).toBeNull();
  });
});
