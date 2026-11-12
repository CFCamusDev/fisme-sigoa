import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppRoleLogin, type AppRoleLoginSession } from '../../test/db/app-role-login.js';
import { useTestDatabase } from '../../test/db/use-test-database.js';
import { createPrismaClient, type CreatedPrismaClient } from './prisma-client.js';
import { PrismaAuditLogger } from './prisma-audit-logger.js';

describe('AuditLog Append-Only Security (PostgreSQL real, RS-040, RNF-014)', () => {
  const { getPrisma } = useTestDatabase();
  const adminPrisma = getPrisma();

  let loginSession: AppRoleLoginSession;
  let appPrismaClient: CreatedPrismaClient;

  beforeAll(async () => {
    loginSession = await createAppRoleLogin();
    appPrismaClient = createPrismaClient(loginSession.url);

    // Creamos una tabla post-migración como admin para validar ALTER DEFAULT PRIVILEGES
    await adminPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS test_post_migration_probe (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);
  });

  afterAll(async () => {
    await adminPrisma.$executeRawUnsafe(`DROP TABLE IF EXISTS test_post_migration_probe;`);
    await appPrismaClient.disconnect();
    await loginSession.drop();
  });

  it('allows application role to INSERT and SELECT on audit_logs', async () => {
    const inserted = await appPrismaClient.prisma.auditLog.create({
      data: {
        action: 'CREATE',
        actor: 'app-role-user',
        entity: 'EducationalObjective',
        entityId: 'oe-append-test-1',
        hash: 'a'.repeat(64),
        occurredAt: new Date(),
        sequence: 99901n,
      },
    });

    expect(inserted.id).toBeDefined();

    const read = await appPrismaClient.prisma.auditLog.findUnique({
      where: { id: inserted.id },
    });

    expect(read).not.toBeNull();
    expect(read?.entityId).toBe('oe-append-test-1');
  });

  it('rejects update and delete for the application role on audit_logs', async () => {
    // Intentar UPDATE debe ser rechazado por PostgreSQL
    await expect(
      appPrismaClient.prisma.auditLog.update({
        data: { actor: 'hacker' },
        where: { sequence: 99901n },
      }),
    ).rejects.toThrow(/permission denied for table audit_logs/i);

    // Intentar DELETE debe ser rechazado por PostgreSQL
    await expect(
      appPrismaClient.prisma.auditLog.delete({
        where: { sequence: 99901n },
      }),
    ).rejects.toThrow(/permission denied for table audit_logs/i);
  });

  it('rejects truncate for the application role on audit_logs', async () => {
    await expect(
      appPrismaClient.prisma.$executeRawUnsafe('TRUNCATE TABLE audit_logs;'),
    ).rejects.toThrow(/permission denied for table audit_logs/i);
  });

  it('still allows full DML on tables created after the migration via default privileges', async () => {
    // INSERT
    await appPrismaClient.prisma.$executeRawUnsafe(
      `INSERT INTO test_post_migration_probe (id, name) VALUES ('probe-1', 'Initial Name');`,
    );

    // SELECT
    const rows = await appPrismaClient.prisma.$queryRawUnsafe<Array<{ id: string; name: string }>>(
      `SELECT id, name FROM test_post_migration_probe WHERE id = 'probe-1';`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0]?.name).toBe('Initial Name');

    // UPDATE
    await appPrismaClient.prisma.$executeRawUnsafe(
      `UPDATE test_post_migration_probe SET name = 'Updated Name' WHERE id = 'probe-1';`,
    );

    // DELETE
    await appPrismaClient.prisma.$executeRawUnsafe(
      `DELETE FROM test_post_migration_probe WHERE id = 'probe-1';`,
    );

    const remaining = await appPrismaClient.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM test_post_migration_probe WHERE id = 'probe-1';`,
    );
    expect(remaining.length).toBe(0);
  });

  it('lets PrismaAuditLogger append under the restricted application role', async () => {
    const logger = new PrismaAuditLogger({
      get: () => appPrismaClient.prisma,
    });

    await logger.log({
      action: 'LOGIN_SUCCESS',
      actor: 'app-user-restricted',
      entity: 'User',
      entityId: 'u-restricted-1',
      after: { success: true },
    });

    const recorded = await appPrismaClient.prisma.auditLog.findFirst({
      where: { entityId: 'u-restricted-1' },
    });

    expect(recorded).not.toBeNull();
    expect(recorded?.actor).toBe('app-user-restricted');
  });

  it('allows application role to UPDATE audit_chain_heads but rejects DELETE and TRUNCATE (RS-040, RNF-014)', async () => {
    // Aseguramos una fila como admin para probar
    await adminPrisma.auditChainHead.upsert({
      where: { id: 'MAIN' },
      create: { id: 'MAIN', sequence: 100n, hash: 'head_perm_test' },
      update: { sequence: 100n, hash: 'head_perm_test' },
    });

    // UPDATE permitido para el rol de aplicación
    const updated = await appPrismaClient.prisma.auditChainHead.update({
      where: { id: 'MAIN' },
      data: { sequence: 101n, hash: 'head_perm_test_updated' },
    });
    expect(updated.sequence).toBe(101n);

    // DELETE rechazado por PostgreSQL
    await expect(
      appPrismaClient.prisma.auditChainHead.delete({
        where: { id: 'MAIN' },
      }),
    ).rejects.toThrow(/permission denied for table audit_chain_heads/i);

    // TRUNCATE rechazado por PostgreSQL
    await expect(
      appPrismaClient.prisma.$executeRawUnsafe('TRUNCATE TABLE audit_chain_heads;'),
    ).rejects.toThrow(/permission denied for table audit_chain_heads/i);
  });
});
