import { describe, expect, it } from 'vitest';
import { InvalidStakeholderDataError } from '../errors/invalid-stakeholder-data-error.js';
import { InvalidStakeholderTransitionError } from '../errors/invalid-stakeholder-transition-error.js';
import { Stakeholder } from './stakeholder.js';

const NOW = new Date('2026-11-16T10:00:00.000Z');
const LATER = new Date('2026-11-16T12:00:00.000Z');

describe('Stakeholder', () => {
  it('registers a person with a DNI and audits it', () => {
    const stakeholder = Stakeholder.register({
      id: 'stk-1',
      kind: 'PERSON',
      fullName: '  Ana Lucia Torres  ',
      dni: ' 45678912 ',
      email: ' Ana.Torres@Example.com ',
      mobile: '987654321',
      position: ' Egresada ',
      institution: ' UNTRM ',
      sector: ' Educacion ',
      graduationYear: 2022,
      cycle: null,
      actorId: 'user-1',
      now: NOW,
    });

    expect(stakeholder.kind).toBe('PERSON');
    expect(stakeholder.status).toBe('ACTIVE');
    expect(stakeholder.fullName).toBe('Ana Lucia Torres');
    expect(stakeholder.dni).toBe('45678912');
    expect(stakeholder.ruc).toBeNull();
    expect(stakeholder.email).toBe('ana.torres@example.com');
    expect(stakeholder.mobile).toBe('987654321');
    expect(stakeholder.graduationYear).toBe(2022);
    expect(stakeholder.voidReason).toBeNull();

    const snapshot = stakeholder.snapshot();
    expect(snapshot).toEqual({
      kind: 'PERSON',
      fullName: 'Ana Lucia Torres',
      dni: '45678912',
      ruc: null,
      hasEmail: true,
      hasMobile: true,
      position: 'Egresada',
      institution: 'UNTRM',
      sector: 'Educacion',
      graduationYear: 2022,
      cycle: null,
      status: 'ACTIVE',
    });
    expect('email' in snapshot).toBe(false);
    expect('mobile' in snapshot).toBe(false);
  });

  it('registers an institution with a RUC', () => {
    const stakeholder = Stakeholder.register({
      id: 'stk-2',
      kind: 'INSTITUTION',
      fullName: '  Tech Amazonas SAC  ',
      ruc: '20123456789',
      email: 'contacto@techamazonas.pe',
      mobile: null,
      position: 'Gerencia TI',
      sector: 'Tecnologia',
      actorId: 'user-1',
      now: NOW,
    });

    expect(stakeholder.kind).toBe('INSTITUTION');
    expect(stakeholder.status).toBe('ACTIVE');
    expect(stakeholder.ruc).toBe('20123456789');
    expect(stakeholder.dni).toBeNull();
    expect(stakeholder.institution).toBeNull();
    expect(stakeholder.graduationYear).toBeNull();
    expect(stakeholder.cycle).toBeNull();
  });

  it('rejects a person without a DNI', () => {
    expect(() =>
      Stakeholder.register({
        id: 'stk-3',
        kind: 'PERSON',
        fullName: 'Carlos Mendoza',
        dni: null,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidStakeholderDataError);
  });

  it('rejects a person with a RUC or invalid DNI format', () => {
    expect(() =>
      Stakeholder.register({
        id: 'stk-4',
        kind: 'PERSON',
        fullName: 'Carlos Mendoza',
        dni: '12345678',
        ruc: '20123456789',
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidStakeholderDataError);

    expect(() =>
      Stakeholder.register({
        id: 'stk-5',
        kind: 'PERSON',
        fullName: 'Carlos Mendoza',
        dni: '1234',
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidStakeholderDataError);
  });

  it('rejects an institution with a DNI', () => {
    expect(() =>
      Stakeholder.register({
        id: 'stk-6',
        kind: 'INSTITUTION',
        fullName: 'Empresa Norte EIRL',
        dni: '12345678',
        ruc: '20123456789',
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidStakeholderDataError);
  });

  it('rejects an institution without a RUC or with person-only fields', () => {
    expect(() =>
      Stakeholder.register({
        id: 'stk-7',
        kind: 'INSTITUTION',
        fullName: 'Empresa Norte EIRL',
        ruc: null,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidStakeholderDataError);

    expect(() =>
      Stakeholder.register({
        id: 'stk-8',
        kind: 'INSTITUTION',
        fullName: 'Empresa Norte EIRL',
        ruc: '20123456789',
        graduationYear: 2020,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidStakeholderDataError);
  });

  it('rejects invalid email, mobile, or out-of-range graduation year', () => {
    expect(() =>
      Stakeholder.register({
        id: 'stk-9',
        kind: 'PERSON',
        fullName: 'Rosa Perez',
        dni: '87654321',
        email: 'correo-invalido',
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidStakeholderDataError);

    expect(() =>
      Stakeholder.register({
        id: 'stk-10',
        kind: 'PERSON',
        fullName: 'Rosa Perez',
        dni: '87654321',
        mobile: '812345678',
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidStakeholderDataError);

    expect(() =>
      Stakeholder.register({
        id: 'stk-11',
        kind: 'PERSON',
        fullName: 'Rosa Perez',
        dni: '87654321',
        graduationYear: 1940,
        actorId: 'user-1',
        now: NOW,
      }),
    ).toThrow(InvalidStakeholderDataError);
  });

  it('edits an active stakeholder and preserves kind and status', () => {
    const stakeholder = Stakeholder.register({
      id: 'stk-12',
      kind: 'PERSON',
      fullName: 'Luis Diaz',
      dni: '11223344',
      actorId: 'user-1',
      now: NOW,
    });

    const edited = stakeholder.edit({
      fullName: 'Luis Alberto Diaz',
      email: 'Luis.Diaz@Example.com',
      mobile: '912345678',
      now: LATER,
    });

    expect(edited.fullName).toBe('Luis Alberto Diaz');
    expect(edited.email).toBe('luis.diaz@example.com');
    expect(edited.mobile).toBe('912345678');
    expect(edited.status).toBe('ACTIVE');
    expect(edited.updatedAt).toEqual(LATER);
  });

  it('voids with a reason and never deletes', () => {
    const stakeholder = Stakeholder.register({
      id: 'stk-13',
      kind: 'PERSON',
      fullName: 'Elena Quispe',
      dni: '22334455',
      actorId: 'user-1',
      now: NOW,
    });

    const voided = stakeholder.void({
      reason: '  Registro duplicado por error de digitacion  ',
      actorId: 'user-2',
      now: LATER,
    });

    expect(voided.status).toBe('VOIDED');
    expect(voided.voidReason).toBe('Registro duplicado por error de digitacion');
    expect(voided.voidedAt).toEqual(LATER);
    expect(voided.voidedBy).toBe('user-2');
    expect(voided.updatedAt).toEqual(LATER);
  });

  it('rejects voiding with a short reason or voiding an already voided stakeholder', () => {
    const stakeholder = Stakeholder.register({
      id: 'stk-14',
      kind: 'PERSON',
      fullName: 'Elena Quispe',
      dni: '22334455',
      actorId: 'user-1',
      now: NOW,
    });

    expect(() =>
      stakeholder.void({
        reason: 'Corto',
        actorId: 'user-2',
        now: LATER,
      }),
    ).toThrow(InvalidStakeholderDataError);

    const voided = stakeholder.void({
      reason: 'Motivo valido con longitud suficiente',
      actorId: 'user-2',
      now: LATER,
    });

    expect(() =>
      voided.void({
        reason: 'Segundo intento de anulacion valido',
        actorId: 'user-2',
        now: LATER,
      }),
    ).toThrow(InvalidStakeholderTransitionError);
  });

  it('rejects editing a voided stakeholder', () => {
    const stakeholder = Stakeholder.register({
      id: 'stk-15',
      kind: 'PERSON',
      fullName: 'Mario Vega',
      dni: '33445566',
      actorId: 'user-1',
      now: NOW,
    }).void({
      reason: 'Constituyente dado de baja por solicitud expresa',
      actorId: 'user-2',
      now: LATER,
    });

    expect(() =>
      stakeholder.edit({
        fullName: 'Mario Vega Actualizado',
        now: LATER,
      }),
    ).toThrow(InvalidStakeholderTransitionError);
  });
});
