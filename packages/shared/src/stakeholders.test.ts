import { describe, expect, it } from 'vitest';
import {
  STAKEHOLDERS_PAGE_SIZE_MAX,
  STAKEHOLDER_FULL_NAME_MAX_LENGTH,
  STAKEHOLDER_GRADUATION_YEAR_MAX,
  STAKEHOLDER_GRADUATION_YEAR_MIN,
  editStakeholderRequestSchema,
  listStakeholdersQuerySchema,
  registerStakeholderRequestSchema,
  stakeholderDtoSchema,
  voidStakeholderRequestSchema,
} from './stakeholders.js';

describe('stakeholders shared schemas (HU-021, T-021-10)', () => {
  it('accepts incomplete but valid optional fields as null', () => {
    const parsedPerson = registerStakeholderRequestSchema.parse({
      kind: 'PERSON',
      fullName: '  Maria Lopez  ',
      dni: '45678912',
      email: null,
      mobile: null,
      position: null,
      institution: null,
      sector: null,
      graduationYear: null,
      cycle: null,
    });

    expect(parsedPerson.fullName).toBe('Maria Lopez');
    expect(parsedPerson.kind).toBe('PERSON');

    const parsedDto = stakeholderDtoSchema.parse({
      id: 'stk-1',
      kind: 'PERSON',
      fullName: 'Maria Lopez',
      dni: '45678912',
      ruc: null,
      email: null,
      mobile: null,
      position: null,
      institution: null,
      sector: null,
      graduationYear: null,
      cycle: null,
      status: 'ACTIVE',
      voidReason: null,
      voidedAt: null,
      voidedBy: null,
      createdAt: '2026-11-16T10:00:00.000Z',
      updatedAt: '2026-11-16T10:00:00.000Z',
    });

    expect(parsedDto.id).toBe('stk-1');
  });

  it('rejects unknown fields', () => {
    const registerResult = registerStakeholderRequestSchema.safeParse({
      kind: 'INSTITUTION',
      fullName: 'Empresa SAC',
      ruc: '20123456789',
      extraField: 'hostile',
    });
    expect(registerResult.success).toBe(false);

    const institutionWithDni = registerStakeholderRequestSchema.safeParse({
      kind: 'INSTITUTION',
      fullName: 'Empresa SAC',
      ruc: '20123456789',
      dni: '12345678',
    });
    expect(institutionWithDni.success).toBe(false);

    const queryResult = listStakeholdersQuerySchema.safeParse({
      page: 1,
      unexpected: true,
    });
    expect(queryResult.success).toBe(false);
  });

  it('rejects pageSize above the maximum', () => {
    const result = listStakeholdersQuerySchema.safeParse({
      page: 1,
      pageSize: STAKEHOLDERS_PAGE_SIZE_MAX + 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects over-long text and out-of-range years', () => {
    const overLongName = registerStakeholderRequestSchema.safeParse({
      kind: 'PERSON',
      fullName: 'a'.repeat(STAKEHOLDER_FULL_NAME_MAX_LENGTH + 1),
      dni: '12345678',
    });
    expect(overLongName.success).toBe(false);

    const yearTooLow = registerStakeholderRequestSchema.safeParse({
      kind: 'PERSON',
      fullName: 'Juan Perez',
      dni: '12345678',
      graduationYear: STAKEHOLDER_GRADUATION_YEAR_MIN - 1,
    });
    expect(yearTooLow.success).toBe(false);

    const yearTooHigh = registerStakeholderRequestSchema.safeParse({
      kind: 'PERSON',
      fullName: 'Juan Perez',
      dni: '12345678',
      graduationYear: STAKEHOLDER_GRADUATION_YEAR_MAX + 1,
    });
    expect(yearTooHigh.success).toBe(false);
  });

  it('requires at least one field on edit and valid reason length on void', () => {
    expect(editStakeholderRequestSchema.safeParse({}).success).toBe(false);
    expect(editStakeholderRequestSchema.safeParse({ position: 'Jefe TI' }).success).toBe(true);

    expect(voidStakeholderRequestSchema.safeParse({ reason: 'corto' }).success).toBe(false);
    expect(
      voidStakeholderRequestSchema.safeParse({ reason: 'Motivo de anulacion valido' }).success,
    ).toBe(true);
  });

  it('validates document filter format in list query', () => {
    expect(listStakeholdersQuerySchema.safeParse({ document: '12345678' }).success).toBe(true);
    expect(listStakeholdersQuerySchema.safeParse({ document: '20123456789' }).success).toBe(true);
    expect(listStakeholdersQuerySchema.safeParse({ document: '123' }).success).toBe(false);
  });
});
