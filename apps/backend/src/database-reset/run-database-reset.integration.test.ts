import { describe, expect, it, vi } from 'vitest';
import { runDatabaseSeed } from '../seed-database.js';
import { useTestDatabase } from '../test/db/use-test-database.js';
import { seedAuthorizationFast } from '../test/factories/authorization.js';
import { DatabaseResetRefusedError, extractDatabaseName } from './reset-policy.js';
import { findUnregisteredTables } from './reset-tables.js';
import { runDatabaseReset } from './run-database-reset.js';

describe('runDatabaseReset Integration (PostgreSQL real, HU-081, T-081-37)', () => {
  const { databaseUrl, getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const databaseName = extractDatabaseName(databaseUrl);

  function resetEnv(overrides: Record<string, string | undefined> = {}) {
    return {
      DB_RESET_ON_DEPLOY: 'true',
      DB_RESET_CONFIRM: databaseName,
      DATABASE_URL: databaseUrl,
      APP_PUBLIC_URL: 'https://staging.sigoa.example.edu.pe',
      ...overrides,
    };
  }

  it('every table of the schema is registered in one of the two lists', async () => {
    const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    expect(findUnregisteredTables(rows.map((r) => r.tablename))).toEqual([]);
  });

  it('does nothing when the flag is false and rejects hostile inputs without touching anything', async () => {
    await seedAuthorizationFast(prisma);
    await prisma.program.create({
      data: { id: 'prog-keep', code: 'EPIS', name: 'Sistemas', faculty: 'FISME' },
    });

    const skipped = await runDatabaseReset({
      prisma,
      rawEnv: resetEnv({ DB_RESET_ON_DEPLOY: 'false' }),
    });
    expect(skipped).toEqual({ action: 'SKIP' });

    await expect(
      runDatabaseReset({
        prisma,
        rawEnv: resetEnv({ DATABASE_URL: 'not-a-url', DB_RESET_CONFIRM: '' }),
      }),
    ).rejects.toBeInstanceOf(DatabaseResetRefusedError);

    expect(await prisma.program.count()).toBe(1);
  });

  it('keeps only users, roles, permissions and their assignments, wipes audit logs and chain head, unlocks users and restores predefined roles', async () => {
    await seedAuthorizationFast(prisma);

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });
    const rolVerPerm = await prisma.permission.findUniqueOrThrow({ where: { code: 'rol.ver' } });
    const docPerm = await prisma.permission.findUniqueOrThrow({
      where: { code: 'documento.descargar' },
    });

    // Alteramos un rol predefinido y creamos un rol manual
    await prisma.role.update({
      where: { id: adminRole.id },
      data: { name: 'Admin Editado', status: 'INACTIVE' },
    });
    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: rolVerPerm.id } },
    });
    const manualRole = await prisma.role.create({
      data: {
        code: 'MANUAL_TEMP',
        name: 'Manual',
        description: 'Temporal',
        isPredefined: false,
        status: 'ACTIVE',
        createdBy: 'SEED',
      },
    });

    const user = await prisma.user.create({
      data: {
        email: 'admin@example.test',
        names: 'Admin',
        firstSurname: 'Prueba',
        status: 'ACTIVE',
        failedLoginAttempts: 5,
        lockedUntil: new Date('2099-01-01T00:00:00.000Z'),
        createdBy: 'SEED',
      },
    });
    await prisma.userRole.createMany({
      data: [
        { userId: user.id, roleId: adminRole.id, createdBy: 'SEED' },
        { userId: user.id, roleId: manualRole.id, createdBy: 'SEED' },
      ],
    });
    await prisma.userPermission.create({
      data: { userId: user.id, permissionId: docPerm.id, scope: 'GLOBAL', createdBy: 'SEED' },
    });
    await prisma.activationToken.create({
      data: {
        userId: user.id,
        tokenHash: 'act-hash-1',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    });
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: 'ref-hash-1',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    });
    await prisma.program.create({
      data: { id: 'prog-wipe', code: 'EPIS', name: 'Sistemas', faculty: 'FISME' },
    });
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Program',
        entityId: 'prog-wipe',
        actor: user.id,
        occurredAt: new Date('2026-01-01T00:00:00.000Z'),
        sequence: 1,
        previousHash: 'GENESIS',
        hash: 'hash-1',
      },
    });
    await prisma.auditChainHead.create({
      data: { id: 'MAIN', sequence: 1, hash: 'hash-1' },
    });

    const infoSpy = vi.fn();
    const result = await runDatabaseReset({
      prisma,
      rawEnv: resetEnv(),
      logger: { info: infoSpy },
    });

    expect(result.action).toBe('RESET');
    if (result.action === 'RESET') {
      expect(result.deletedRowsByTable.programs).toBe(1);
      expect(result.deletedRowsByTable.audit_logs).toBe(1);
      expect(result.deletedRowsByTable.audit_chain_heads).toBe(1);
      expect(result.deletedRowsByTable.refresh_tokens).toBe(1);
    }

    expect(await prisma.program.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
    expect(await prisma.auditChainHead.count()).toBe(0);
    expect(await prisma.refreshToken.count()).toBe(0);

    // Usuarios, asignaciones directas y tokens de activación conservados y desbloqueados
    const keptUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(keptUser.failedLoginAttempts).toBe(0);
    expect(keptUser.lockedUntil).toBeNull();
    expect(await prisma.activationToken.count()).toBe(1);
    expect(await prisma.userPermission.count()).toBe(1);
    expect(await prisma.userRole.findMany({ where: { userId: user.id } })).toHaveLength(1);

    // Roles restaurados
    expect(await prisma.role.findUnique({ where: { code: 'MANUAL_TEMP' } })).toBeNull();
    const restoredAdmin = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });
    expect(restoredAdmin.name).toBe('Administrador');
    expect(restoredAdmin.status).toBe('ACTIVE');
    expect(
      await prisma.rolePermission.findUnique({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: rolVerPerm.id } },
      }),
    ).not.toBeNull();

    // Log contiene el aviso para volver a false
    expect(infoSpy.mock.calls.some((c) => String(c[0]).includes('DB_RESET_ON_DEPLOY=false'))).toBe(
      true,
    );

    // db:seed después de un reset restaura datos iniciales y es idempotente
    const seedEnv = {
      ADMIN_EMAIL: 'primer.admin@example.test',
      ADMIN_NAMES: 'Primer',
      ADMIN_FIRST_SURNAME: 'Admin',
      ADMIN_DNI: '12345678',
    };
    const hasher = { hash: async (plain: string) => `hash:${plain}` };
    await runDatabaseSeed({ prisma, rawEnv: seedEnv, hasher });
    await runDatabaseSeed({ prisma, rawEnv: seedEnv, hasher });
    expect(await prisma.program.count()).toBe(1);
    expect(await prisma.template.count()).toBeGreaterThan(0);
  }, 15_000);

  it('aborts before deleting when a table is not registered', async () => {
    await prisma.program.create({
      data: { id: 'prog-safe', code: 'EPIS', name: 'Sistemas', faculty: 'FISME' },
    });

    await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "tmp_unregistered_test" (id int)');
    try {
      await expect(
        runDatabaseReset({
          prisma,
          rawEnv: resetEnv(),
        }),
      ).rejects.toThrow(/tmp_unregistered_test/);

      expect(await prisma.program.count()).toBe(1);
    } finally {
      await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "tmp_unregistered_test"');
    }
  });

  it('serializes two concurrent resets and ends in the same consistent state', async () => {
    await seedAuthorizationFast(prisma);
    await prisma.program.create({
      data: { id: 'prog-conc', code: 'EPIS', name: 'Sistemas', faculty: 'FISME' },
    });

    const [r1, r2] = await Promise.all([
      runDatabaseReset({ prisma, rawEnv: resetEnv() }),
      runDatabaseReset({ prisma, rawEnv: resetEnv() }),
    ]);

    expect(r1.action).toBe('RESET');
    expect(r2.action).toBe('RESET');
    expect(await prisma.program.count()).toBe(0);
    expect(await prisma.role.count()).toBe(5);
  });

  it('rolls back everything when the lock times out', async () => {
    await seedAuthorizationFast(prisma);
    await prisma.program.create({
      data: { id: 'prog-locked', code: 'EPIS', name: 'Sistemas', faculty: 'FISME' },
    });

    let signalLocked!: () => void;
    const lockedReady = new Promise<void>((resolve) => {
      signalLocked = resolve;
    });
    let releaseHolder!: () => void;
    const holderDone = new Promise<void>((resolve) => {
      releaseHolder = resolve;
    });

    const lockHolder = prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('LOCK TABLE "programs" IN ACCESS EXCLUSIVE MODE');
      signalLocked();
      await holderDone;
    });

    await lockedReady;

    try {
      await expect(
        runDatabaseReset({
          prisma,
          rawEnv: resetEnv(),
          lockTimeoutMs: 300,
        }),
      ).rejects.toThrow();
    } finally {
      releaseHolder();
      await lockHolder;
    }

    expect(await prisma.program.count()).toBe(1);
  });
});
