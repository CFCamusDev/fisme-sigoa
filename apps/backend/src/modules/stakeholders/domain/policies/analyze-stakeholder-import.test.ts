import { describe, expect, it } from 'vitest';
import { Stakeholder } from '../entities/stakeholder.js';
import { analyzeStakeholderImport } from './analyze-stakeholder-import.js';

const NOW = new Date('2026-11-17T10:00:00.000Z');

function createSequentialIds(): () => string {
  let seq = 0;
  return () => {
    seq += 1;
    return `id-${seq}`;
  };
}

function createExistingPerson(
  overrides: Partial<Parameters<typeof Stakeholder.register>[0]> = {},
): Stakeholder {
  return Stakeholder.register({
    id: 'stk-existing-person',
    kind: 'PERSON',
    fullName: 'Lucia Vega Rojas',
    dni: '45678912',
    email: 'lucia.vega@example.com',
    mobile: '987654321',
    institution: 'UNTRM',
    graduationYear: 2022,
    cycle: 'IX',
    actorId: 'user-1',
    now: NOW,
    ...overrides,
  });
}

function createExistingInstitution(
  overrides: Partial<Parameters<typeof Stakeholder.register>[0]> = {},
): Stakeholder {
  return Stakeholder.register({
    id: 'stk-existing-inst',
    kind: 'INSTITUTION',
    fullName: 'Andes Tech SAC',
    ruc: '20123456789',
    sector: 'Tecnologia',
    position: 'Gerente',
    email: 'contacto@andestech.example.com',
    mobile: '987654322',
    actorId: 'user-1',
    now: NOW,
    ...overrides,
  });
}

describe('analyzeStakeholderImport', () => {
  it('classifies valid rows and reports one error list per invalid row', () => {
    const result = analyzeStakeholderImport({
      listType: 'TEACHER',
      rows: [
        {
          rowNumber: 2,
          values: {
            document: '71234567',
            fullName: 'Mario Quispe Salas',
            email: 'mario.quispe@example.com',
            mobile: '912345678',
          },
        },
        {
          rowNumber: 3,
          values: {
            document: '123',
            fullName: 'Fila Invalida',
            email: 'invalido@example.com',
            mobile: '912345679',
          },
        },
        {
          rowNumber: 4,
          values: {
            document: '71234568',
            fullName: 'Sin Correo',
            email: null,
            mobile: '912345680',
          },
        },
      ],
      existingByDocument: new Map(),
      memberStakeholderIds: new Set(),
      idGenerator: createSequentialIds(),
      actorId: 'actor-1',
      now: NOW,
    });

    expect(result.totals).toEqual({
      total: 3,
      new: 1,
      existing: 0,
      alreadyInList: 0,
      invalid: 2,
    });
    expect(result.rows[0]?.status).toBe('NEW');
    expect(result.rows[0]?.stakeholderToCreate?.dni).toBe('71234567');
    expect(result.rows[0]?.memberToAdd?.stakeholderId).toBe('id-1');
    expect(result.rows[1]?.status).toBe('INVALID');
    expect(result.rows[1]?.errors.length).toBeGreaterThan(0);
    expect(result.rows[2]?.status).toBe('INVALID');
    expect(result.rows[2]?.errors[0]).toContain('correo');
  });

  it('marks a row as existing when the DNI or RUC is already registered', () => {
    const existing = createExistingInstitution();

    const result = analyzeStakeholderImport({
      listType: 'EMPLOYER',
      rows: [
        {
          rowNumber: 2,
          values: {
            document: '20123456789',
            fullName: 'Otro Nombre Ignorado',
            sector: 'Otro Sector',
            representative: 'Carlos Mendoza',
            email: 'otro@example.com',
            mobile: '999999999',
            position: 'Director',
          },
        },
      ],
      existingByDocument: new Map([['20123456789', existing]]),
      memberStakeholderIds: new Set(),
      idGenerator: createSequentialIds(),
      actorId: 'actor-1',
      now: NOW,
    });

    expect(result.totals.existing).toBe(1);
    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      status: 'EXISTING',
      document: '20123456789',
      fullName: 'Andes Tech SAC',
      errors: [],
      stakeholderToCreate: null,
    });
    expect(result.rows[0]?.memberToAdd?.stakeholderId).toBe(existing.id);
    expect(result.rows[0]?.memberToAdd?.snapshot.representative).toBe('Carlos Mendoza');
    expect(result.rows[0]?.memberToAdd?.snapshot.email).toBe('contacto@andestech.example.com');
  });

  it('marks an existing member as already in the list', () => {
    const existing = createExistingPerson();

    const result = analyzeStakeholderImport({
      listType: 'GRADUATE',
      rows: [
        {
          rowNumber: 2,
          values: {
            document: '45678912',
            fullName: 'Lucia Vega Rojas',
            graduationYear: '2022',
            email: 'lucia.vega@example.com',
            mobile: '987654321',
          },
        },
      ],
      existingByDocument: new Map([['45678912', existing]]),
      memberStakeholderIds: new Set([existing.id]),
      idGenerator: createSequentialIds(),
      actorId: 'actor-1',
      now: NOW,
    });

    expect(result.totals.alreadyInList).toBe(1);
    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      status: 'ALREADY_IN_LIST',
      document: '45678912',
      fullName: 'Lucia Vega Rojas',
      errors: [],
      stakeholderToCreate: null,
      memberToAdd: null,
    });
  });

  it('rejects a repeated document inside the file', () => {
    const result = analyzeStakeholderImport({
      listType: 'STUDENT',
      rows: [
        {
          rowNumber: 2,
          values: {
            document: '71234567',
            fullName: 'Primero',
            cycle: 'VIII',
            email: 'primero@example.com',
            mobile: '912345671',
          },
        },
        {
          rowNumber: 3,
          values: {
            document: '71234567',
            fullName: 'Duplicado',
            cycle: 'IX',
            email: 'segundo@example.com',
            mobile: '912345672',
          },
        },
      ],
      existingByDocument: new Map(),
      memberStakeholderIds: new Set(),
      idGenerator: createSequentialIds(),
      actorId: 'actor-1',
      now: NOW,
    });

    expect(result.totals.new).toBe(1);
    expect(result.totals.invalid).toBe(1);
    expect(result.rows[1]?.status).toBe('INVALID');
    expect(result.rows[1]?.errors[0]).toContain('repetido');
  });

  it('rejects a voided stakeholder', () => {
    const voided = createExistingPerson().void({
      reason: 'Registro duplicado por error de digitacion.',
      actorId: 'admin-1',
      now: NOW,
    });

    const result = analyzeStakeholderImport({
      listType: 'TEACHER',
      rows: [
        {
          rowNumber: 2,
          values: {
            document: '45678912',
            fullName: 'Lucia Vega Rojas',
            email: 'lucia.vega@example.com',
            mobile: '987654321',
          },
        },
      ],
      existingByDocument: new Map([['45678912', voided]]),
      memberStakeholderIds: new Set(),
      idGenerator: createSequentialIds(),
      actorId: 'actor-1',
      now: NOW,
    });

    expect(result.totals.invalid).toBe(1);
    expect(result.rows[0]?.status).toBe('INVALID');
    expect(result.rows[0]?.errors[0]).toContain('anulado');
  });

  it('reports the missing fields of an existing stakeholder', () => {
    const incomplete = createExistingPerson({ graduationYear: null });

    const result = analyzeStakeholderImport({
      listType: 'GRADUATE',
      rows: [
        {
          rowNumber: 2,
          values: {
            document: '45678912',
            fullName: 'Lucia Vega Rojas',
            graduationYear: '2022',
            email: 'lucia.vega@example.com',
            mobile: '987654321',
          },
        },
      ],
      existingByDocument: new Map([['45678912', incomplete]]),
      memberStakeholderIds: new Set(),
      idGenerator: createSequentialIds(),
      actorId: 'actor-1',
      now: NOW,
    });

    expect(result.totals.invalid).toBe(1);
    expect(result.rows[0]?.status).toBe('INVALID');
    expect(result.rows[0]?.errors[0]).toContain('año de egreso');
    expect(result.rows[0]?.errors[0]).toContain('Edita el registro maestro');
  });

  it('pads numeric DNI and RUC with leading zeros', () => {
    const dniResult = analyzeStakeholderImport({
      listType: 'TEACHER',
      rows: [
        {
          rowNumber: 2,
          values: {
            document: '1234567',
            fullName: 'Docente Cero',
            email: 'docente@example.com',
            mobile: '912345678',
          },
        },
      ],
      existingByDocument: new Map(),
      memberStakeholderIds: new Set(),
      idGenerator: createSequentialIds(),
      actorId: 'actor-1',
      now: NOW,
    });

    const rucResult = analyzeStakeholderImport({
      listType: 'EMPLOYER',
      rows: [
        {
          rowNumber: 2,
          values: {
            document: '1234567890',
            fullName: 'Empresa Cero SAC',
            sector: 'Servicios',
            representative: 'Rosa Perez',
            email: 'empresa@example.com',
            mobile: '912345679',
            position: 'Gerente',
          },
        },
      ],
      existingByDocument: new Map(),
      memberStakeholderIds: new Set(),
      idGenerator: createSequentialIds(),
      actorId: 'actor-1',
      now: NOW,
    });

    expect(dniResult.rows[0]?.status).toBe('NEW');
    expect(dniResult.rows[0]?.document).toBe('01234567');
    expect(rucResult.rows[0]?.status).toBe('NEW');
    expect(rucResult.rows[0]?.document).toBe('01234567890');
  });

  it('builds a person for an eight-digit document and an institution for eleven digits in the advisory board', () => {
    const result = analyzeStakeholderImport({
      listType: 'ADVISORY_BOARD',
      rows: [
        {
          rowNumber: 2,
          values: {
            document: '1234567',
            fullName: 'Elena Diaz',
            institution: 'Colegio de Ingenieros',
            activity: 'Evaluadora externa',
            email: 'elena@example.com',
            mobile: '912345670',
          },
        },
        {
          rowNumber: 3,
          values: {
            document: '20987654321',
            fullName: 'Camara de Comercio',
            institution: null,
            activity: 'Aliado estrategico',
            email: 'camara@example.com',
            mobile: '912345671',
          },
        },
      ],
      existingByDocument: new Map(),
      memberStakeholderIds: new Set(),
      idGenerator: createSequentialIds(),
      actorId: 'actor-1',
      now: NOW,
    });

    expect(result.totals.new).toBe(2);
    expect(result.rows[0]?.stakeholderToCreate?.kind).toBe('PERSON');
    expect(result.rows[0]?.stakeholderToCreate?.dni).toBe('01234567');
    expect(result.rows[1]?.stakeholderToCreate?.kind).toBe('INSTITUTION');
    expect(result.rows[1]?.stakeholderToCreate?.ruc).toBe('20987654321');
  });

  it('collects every error of a row instead of stopping at the first one', () => {
    const result = analyzeStakeholderImport({
      listType: 'EMPLOYER',
      rows: [
        {
          rowNumber: 2,
          values: {
            document: '123',
            fullName: 'Empresa con errores',
            sector: 'Tecnologia',
            position: 'Gerente',
            representative: null,
            email: 'correo-invalido',
            mobile: '12345',
          },
        },
      ],
      existingByDocument: new Map(),
      memberStakeholderIds: new Set(),
      idGenerator: createSequentialIds(),
      actorId: 'actor-1',
      now: NOW,
    });

    expect(result.totals.invalid).toBe(1);
    const errors = result.rows[0]?.errors ?? [];
    expect(errors).toContain('El RUC debe tener exactamente 11 dígitos numéricos.');
    expect(errors).toContain('El correo electrónico no tiene un formato válido.');
    expect(errors).toContain('El celular debe tener 9 dígitos e iniciar con 9.');
    expect(errors.some((e) => e.includes('representante'))).toBe(true);
  });
});
