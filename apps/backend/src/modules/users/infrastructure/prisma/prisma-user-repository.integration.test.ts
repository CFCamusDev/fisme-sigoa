import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaUserRepository } from './prisma-user-repository.js';
import { User } from '../../domain/entities/user.js';
import {
  UserDniAlreadyExistsError,
  UserEmailAlreadyExistsError,
} from '../../domain/errors/index.js';

describe('PrismaUserRepository Integration (PostgreSQL real, users module)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const userRepo = new PrismaUserRepository(uow);

  it('adds a user and reads it back by id, email and dni', async () => {
    const user = User.create({
      id: 'repo-crud-user-id-1',
      names: 'Carlos Alberto',
      firstSurname: 'Mendoza',
      secondSurname: 'Paredes',
      email: 'carlos.mendoza@untrm.edu.pe',
      dni: '87654321',
      createdBy: 'admin-seed-id',
    });

    await userRepo.add(user);

    const byId = await userRepo.findById('repo-crud-user-id-1');
    expect(byId).not.toBeNull();
    expect(byId?.id).toBe('repo-crud-user-id-1');
    expect(byId?.names).toBe('Carlos Alberto');
    expect(byId?.email).toBe('carlos.mendoza@untrm.edu.pe');
    expect(byId?.dni).toBe('87654321');

    const byEmail = await userRepo.findByEmail('carlos.mendoza@untrm.edu.pe');
    expect(byEmail).not.toBeNull();
    expect(byEmail?.id).toBe('repo-crud-user-id-1');

    const byDni = await userRepo.findByDni('87654321');
    expect(byDni).not.toBeNull();
    expect(byDni?.id).toBe('repo-crud-user-id-1');
  }, 15_000);

  it('finds by email ignoring case', async () => {
    const user = User.create({
      id: 'repo-case-user-id-2',
      names: 'Maria Elena',
      firstSurname: 'Rojas',
      email: 'maria.rojas@untrm.edu.pe',
      dni: '87654322',
    });
    await userRepo.add(user);

    const found = await userRepo.findByEmail('   MARIA.ROJAS@UNTRM.EDU.PE   ');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('repo-case-user-id-2');
    expect(found?.email).toBe('maria.rojas@untrm.edu.pe');
  }, 15_000);

  it('maps a duplicated email to UserEmailAlreadyExistsError', async () => {
    const user1 = User.create({
      id: 'repo-dup-email-1',
      names: 'User One',
      firstSurname: 'Test',
      email: 'duplicate.email@untrm.edu.pe',
      dni: '87654323',
    });
    await userRepo.add(user1);

    const user2 = User.create({
      id: 'repo-dup-email-2',
      names: 'User Two',
      firstSurname: 'Test',
      email: 'duplicate.email@untrm.edu.pe',
      dni: '87654324',
    });

    await expect(userRepo.add(user2)).rejects.toThrow(UserEmailAlreadyExistsError);
  }, 15_000);

  it('maps a duplicated dni to UserDniAlreadyExistsError', async () => {
    const user1 = User.create({
      id: 'repo-dup-dni-1',
      names: 'Dni One',
      firstSurname: 'Test',
      email: 'dni.one@untrm.edu.pe',
      dni: '87654325',
    });
    await userRepo.add(user1);

    const user2 = User.create({
      id: 'repo-dup-dni-2',
      names: 'Dni Two',
      firstSurname: 'Test',
      email: 'dni.two@untrm.edu.pe',
      dni: '87654325',
    });

    await expect(userRepo.add(user2)).rejects.toThrow(UserDniAlreadyExistsError);
  }, 15_000);

  it('only one of N concurrent adds with the same email succeeds', async () => {
    const sharedEmail = 'concurrent.add@untrm.edu.pe';
    const users = Array.from({ length: 5 }, (_, i) =>
      User.create({
        id: `concurrent-add-id-${i}`,
        names: `User ${i}`,
        firstSurname: 'Concurrent',
        email: sharedEmail,
        dni: `8765433${i}`,
      }),
    );

    const results = await Promise.allSettled(users.map((u) => userRepo.add(u)));

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);
    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect(rej.reason).toBeInstanceOf(UserEmailAlreadyExistsError);
      }
    }
  }, 15_000);

  it('save updates profile data and status but keeps credentials and lockout', async () => {
    const initial = await prisma.user.create({
      data: {
        id: 'repo-save-keep-cred-id',
        names: 'Initial Name',
        firstSurname: 'Initial Surname',
        secondSurname: 'Initial Second',
        email: 'initial.keep@untrm.edu.pe',
        dni: '87654326',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$somehash',
        failedLoginAttempts: 3,
        lockedUntil: new Date('2026-11-04T00:00:00.000Z'),
        status: 'ACTIVE',
      },
    });

    const user = await userRepo.findById('repo-save-keep-cred-id');
    expect(user).not.toBeNull();

    user!.applyChanges(
      {
        names: 'Updated Name',
        firstSurname: 'Updated Surname',
        secondSurname: 'Updated Second',
        email: 'updated.keep@untrm.edu.pe',
        dni: '87654327',
      },
      'admin-updater-id',
    );
    user!.deactivate('admin-updater-id');

    await userRepo.save(user!);

    const inDb = await prisma.user.findUniqueOrThrow({
      where: { id: 'repo-save-keep-cred-id' },
    });

    expect(inDb.names).toBe('Updated Name');
    expect(inDb.firstSurname).toBe('Updated Surname');
    expect(inDb.secondSurname).toBe('Updated Second');
    expect(inDb.email).toBe('updated.keep@untrm.edu.pe');
    expect(inDb.dni).toBe('87654327');
    expect(inDb.status).toBe('INACTIVE');
    expect(inDb.updatedBy).toBe('admin-updater-id');
    // Las credenciales y bloqueo no deben tocarse
    expect(inDb.passwordHash).toBe(initial.passwordHash);
    expect(inDb.failedLoginAttempts).toBe(3);
    expect(inDb.lockedUntil?.toISOString()).toBe(initial.lockedUntil?.toISOString());
  }, 15_000);

  it('findByIdForUpdate serializes two concurrent transactions', async () => {
    const id = 'repo-lock-user-id-8';
    await prisma.user.create({
      data: {
        id,
        names: 'Lock User',
        firstSurname: 'Concurrent',
        email: 'lock.user@untrm.edu.pe',
        dni: '87654328',
        status: 'ACTIVE',
      },
    });

    let tx1ReadNotify: () => void = () => {};
    const tx1ReadPromise = new Promise<void>((resolve) => {
      tx1ReadNotify = resolve;
    });

    let tx2AttemptNotify: () => void = () => {};
    const tx2AttemptPromise = new Promise<void>((resolve) => {
      tx2AttemptNotify = resolve;
    });

    const updatesOrder: string[] = [];

    const tx1 = uow.run(async () => {
      const u1 = await userRepo.findByIdForUpdate(id);
      expect(u1).not.toBeNull();
      tx1ReadNotify();

      await tx2AttemptPromise;
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      u1!.applyChanges({ names: 'First Tx Name' }, 'admin-1');
      await userRepo.save(u1!);
      updatesOrder.push('tx1');
    });

    const tx2 = (async () => {
      await tx1ReadPromise;
      return uow.run(async () => {
        tx2AttemptNotify();
        const u2 = await userRepo.findByIdForUpdate(id);
        expect(u2).not.toBeNull();
        expect(u2?.names).toBe('First Tx Name'); // tx2 debe esperar a tx1 y leer su commit
        u2!.applyChanges({ names: 'Second Tx Name' }, 'admin-2');
        await userRepo.save(u2!);
        updatesOrder.push('tx2');
      });
    })();

    await Promise.all([tx1, tx2]);

    expect(updatesOrder).toEqual(['tx1', 'tx2']);
    const finalInDb = await prisma.user.findUniqueOrThrow({ where: { id } });
    expect(finalInDb.names).toBe('Second Tx Name');
  }, 15_000);

  it('findByIdForUpdate fails outside a transaction', async () => {
    await expect(userRepo.findByIdForUpdate('any-id')).rejects.toThrow(
      'findByIdForUpdate solo puede ejecutarse dentro de una transacción activa (UnitOfWork).',
    );
  }, 15_000);
});
