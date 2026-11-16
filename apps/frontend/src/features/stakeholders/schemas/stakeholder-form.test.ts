import { describe, expect, it } from 'vitest';
import {
  buildEditStakeholderPayload,
  getInitialStakeholderFormValues,
  stakeholderFormSchema,
} from './stakeholder-form';

describe('stakeholder-form schema (HU-021, T-021-18, T-021-29)', () => {
  it('accepts an incomplete but valid person with only fullName and DNI', () => {
    const values = {
      ...getInitialStakeholderFormValues(),
      kind: 'PERSON' as const,
      fullName: 'Ana Torres',
      dni: '45678912',
    };
    expect(stakeholderFormSchema.safeParse(values).success).toBe(true);
  });

  it('rejects hostile inputs (short DNI, short RUC, invalid mobile, bad email, out-of-range year)', () => {
    const base = getInitialStakeholderFormValues();

    expect(
      stakeholderFormSchema.safeParse({ ...base, fullName: 'Ana', dni: '1234567' }).success,
    ).toBe(false);

    expect(
      stakeholderFormSchema.safeParse({
        ...base,
        kind: 'INSTITUTION',
        fullName: 'Empresa',
        ruc: '2012345678',
      }).success,
    ).toBe(false);

    expect(
      stakeholderFormSchema.safeParse({
        ...base,
        fullName: 'Ana',
        dni: '45678912',
        mobile: '812345678',
      }).success,
    ).toBe(false);

    expect(
      stakeholderFormSchema.safeParse({
        ...base,
        fullName: 'Ana',
        dni: '45678912',
        email: 'no-es-correo',
      }).success,
    ).toBe(false);

    expect(
      stakeholderFormSchema.safeParse({
        ...base,
        fullName: 'Ana',
        dni: '45678912',
        graduationYear: '1949',
      }).success,
    ).toBe(false);
  });

  it('builds partial edit payload with only dirty fields and null for cleared optional fields', () => {
    const values = {
      ...getInitialStakeholderFormValues(),
      fullName: 'Ana Torres',
      dni: '45678912',
      email: '   ',
      position: 'Jefa TI',
    };

    const payload = buildEditStakeholderPayload(values, {
      email: true,
      position: true,
    });

    expect(payload).toEqual({
      email: null,
      position: 'Jefa TI',
    });
  });
});
