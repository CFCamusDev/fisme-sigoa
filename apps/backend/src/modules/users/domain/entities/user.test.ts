import { describe, expect, it } from 'vitest';
import { User } from './user.js';
import { InvalidUserDataError, InvalidUserStatusTransitionError } from '../errors/index.js';

describe('User Domain Entity (T-003-03, T-003-18, RF-003, RS-015, LS 5.14)', () => {
  const baseProps = {
    id: 'user-uuid-1',
    names: 'Juan Carlos',
    firstSurname: 'Pérez',
    secondSurname: 'Gómez',
    email: 'juan.perez@untrm.edu.pe',
    dni: '12345678',
    createdBy: 'admin-uuid',
  };

  it('creates a user pending activation', () => {
    const user = User.create(baseProps);

    expect(user.id).toBe('user-uuid-1');
    expect(user.names).toBe('Juan Carlos');
    expect(user.firstSurname).toBe('Pérez');
    expect(user.secondSurname).toBe('Gómez');
    expect(user.email).toBe('juan.perez@untrm.edu.pe');
    expect(user.dni).toBe('12345678');
    expect(user.status).toBe('PENDING_ACTIVATION');
    expect(user.createdBy).toBe('admin-uuid');
    expect(user.updatedBy).toBeNull();
    expect(user.lastLoginAt).toBeNull();
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it('normalizes email, names and spaces', () => {
    const user = User.create({
      ...baseProps,
      names: '  Juan   Carlos   Alberto  ',
      firstSurname: '  Pérez   Del   Solar  ',
      secondSurname: '   Gómez   ',
      email: '  JUAN.PEREZ@UNTRM.EDU.PE  ',
      dni: '  12345678  ',
    });

    expect(user.names).toBe('Juan Carlos Alberto');
    expect(user.firstSurname).toBe('Pérez Del Solar');
    expect(user.secondSurname).toBe('Gómez');
    expect(user.email).toBe('juan.perez@untrm.edu.pe');
    expect(user.dni).toBe('12345678');
  });

  it('rejects an invalid dni', () => {
    expect(() =>
      User.create({
        ...baseProps,
        dni: '1234567',
      }),
    ).toThrow(InvalidUserDataError);

    expect(() =>
      User.create({
        ...baseProps,
        dni: '123456789',
      }),
    ).toThrow(InvalidUserDataError);

    expect(() =>
      User.create({
        ...baseProps,
        dni: '1234567A',
      }),
    ).toThrow(InvalidUserDataError);
  });

  it('rejects an invalid email or empty names', () => {
    expect(() =>
      User.create({
        ...baseProps,
        email: 'invalid-email',
      }),
    ).toThrow(InvalidUserDataError);

    expect(() =>
      User.create({
        ...baseProps,
        names: '   ',
      }),
    ).toThrow(InvalidUserDataError);

    expect(() =>
      User.create({
        ...baseProps,
        firstSurname: '   ',
      }),
    ).toThrow(InvalidUserDataError);
  });

  it('applies only the present changes and returns before and after', () => {
    const user = User.create(baseProps);
    const result = user.applyChanges(
      {
        names: 'Juan Manuel',
        email: 'juan.manuel@untrm.edu.pe',
      },
      'admin-updater',
    );

    expect(result.before.names).toBe('Juan Carlos');
    expect(result.before.email).toBe('juan.perez@untrm.edu.pe');
    expect(result.after.names).toBe('Juan Manuel');
    expect(result.after.email).toBe('juan.manuel@untrm.edu.pe');
    expect(user.names).toBe('Juan Manuel');
    expect(user.firstSurname).toBe('Pérez'); // Sin cambios
    expect(user.updatedBy).toBe('admin-updater');
  });

  it('rejects invalid changes without mutating the user', () => {
    const user = User.create(baseProps);
    const originalNames = user.names;
    const originalEmail = user.email;

    expect(() =>
      user.applyChanges(
        {
          names: '',
          email: 'new.email@untrm.edu.pe',
        },
        'admin-updater',
      ),
    ).toThrow(InvalidUserDataError);

    expect(user.names).toBe(originalNames);
    expect(user.email).toBe(originalEmail);
  });

  it('deactivates an active user', () => {
    const user = User.restore({
      ...baseProps,
      secondSurname: 'Gómez',
      dni: '12345678',
      status: 'ACTIVE',
      lastLoginAt: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = user.deactivate('admin-updater');
    expect(result.before.status).toBe('ACTIVE');
    expect(result.after.status).toBe('INACTIVE');
    expect(user.status).toBe('INACTIVE');
    expect(user.updatedBy).toBe('admin-updater');
  });

  it('reactivates an inactive user', () => {
    const user = User.restore({
      ...baseProps,
      secondSurname: 'Gómez',
      dni: '12345678',
      status: 'INACTIVE',
      lastLoginAt: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = user.reactivate('admin-updater');
    expect(result.before.status).toBe('INACTIVE');
    expect(result.after.status).toBe('ACTIVE');
    expect(user.status).toBe('ACTIVE');
    expect(user.updatedBy).toBe('admin-updater');
  });

  it('rejects deactivating a pending user', () => {
    const user = User.create(baseProps);
    expect(() => user.deactivate('admin-updater')).toThrow(InvalidUserStatusTransitionError);
    expect(user.status).toBe('PENDING_ACTIVATION');
  });

  it('rejects deactivating an inactive user', () => {
    const user = User.restore({
      ...baseProps,
      secondSurname: 'Gómez',
      dni: '12345678',
      status: 'INACTIVE',
      lastLoginAt: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(() => user.deactivate('admin-updater')).toThrow(InvalidUserStatusTransitionError);
  });

  it('rejects reactivating an active or pending user', () => {
    const activeUser = User.restore({
      ...baseProps,
      secondSurname: 'Gómez',
      dni: '12345678',
      status: 'ACTIVE',
      lastLoginAt: null,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(() => activeUser.reactivate('admin-updater')).toThrow(InvalidUserStatusTransitionError);

    const pendingUser = User.create(baseProps);
    expect(() => pendingUser.reactivate('admin-updater')).toThrow(InvalidUserStatusTransitionError);
  });

  it('audit snapshot masks the dni and never includes credentials', () => {
    const user = User.create(baseProps);
    const snapshot = user.toAuditSnapshot();

    expect(snapshot.dni).toBe('******78');
    expect(snapshot.email).toBe('juan.perez@untrm.edu.pe');
    expect((snapshot as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
    expect((snapshot as unknown as Record<string, unknown>).failedLoginAttempts).toBeUndefined();
    expect((snapshot as unknown as Record<string, unknown>).lockedUntil).toBeUndefined();
  });
});
