import * as argon2 from 'argon2';
import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from './modules/auth/infrastructure/security/argon2-password-hasher.js';
import { OFFICIAL_TEMPLATES } from './modules/templates/infrastructure/prisma/seed/template-seed-data.js';
import { BootstrapAdminConfigError } from './modules/users/domain/errors/bootstrap-admin-config-error.js';
import { BootstrapAdminConflictError } from './modules/users/domain/errors/bootstrap-admin-conflict-error.js';
import { runDatabaseSeed } from './seed-database.js';
import { useTestDatabase } from './test/db/use-test-database.js';

const PASSWORD = 'Clave-Secreta-2026';
const ADMIN_EMAIL = 'admin.semilla@example.test';
const ADMIN_ENV = {
  ADMIN_EMAIL,
  ADMIN_FULL_NAME: 'Ana Maria Quispe Rojas',
  ADMIN_DNI: '12345678',
  ADMIN_INITIAL_PASSWORD: PASSWORD,
};

const TEST_TIMEOUT_MS = 60_000;

describe('Database seed (PostgreSQL real, HU-079)', () => {
  const { getPrisma } = useTestDatabase();
  const hasher = new Argon2PasswordHasher();

  function seed(rawEnv: Record<string, string | undefined>) {
    return runDatabaseSeed({ prisma: getPrisma(), rawEnv, hasher });
  }

  async function countRows() {
    const prisma = getPrisma();
    const [permissions, roles, rolePermissions, users, userRoles, programs] = await Promise.all([
      prisma.permission.count(),
      prisma.role.count(),
      prisma.rolePermission.count(),
      prisma.user.count(),
      prisma.userRole.count(),
      prisma.program.count(),
    ]);
    return { permissions, roles, rolePermissions, users, userRoles, programs };
  }

  it(
    'seeds an empty database completely and creates the first administrator',
    async () => {
      const prisma = getPrisma();

      await seed(ADMIN_ENV);

      const counts = await countRows();
      expect(counts.roles).toBe(5);
      expect(counts.permissions).toBeGreaterThan(0);
      expect(counts.rolePermissions).toBeGreaterThan(0);
      expect(counts.programs).toBe(1);
      expect(await prisma.parameter.count()).toBeGreaterThan(0);
      expect(await prisma.responseScale.count()).toBeGreaterThan(0);
      const catalogVersion = await prisma.catalogVersion.findFirstOrThrow();
      expect(catalogVersion).toMatchObject({ number: 1, status: 'APPROVED' });
      expect(
        await prisma.educationalObjective.count({ where: { versionId: catalogVersion.id } }),
      ).toBe(4);
      expect(
        await prisma.graduateAttribute.count({ where: { versionId: catalogVersion.id } }),
      ).toBe(12);
      expect(await prisma.template.count()).toBe(OFFICIAL_TEMPLATES.length);
      expect(
        await prisma.templateVersion.count({ where: { number: 1, status: 'PUBLISHED' } }),
      ).toBe(OFFICIAL_TEMPLATES.length);

      const admin = await prisma.user.findUniqueOrThrow({
        where: { email: ADMIN_EMAIL },
        include: { userRoles: { include: { role: true } } },
      });
      expect(admin.status).toBe('ACTIVE');
      expect(admin.names).toBe('Ana Maria');
      expect(admin.firstSurname).toBe('Quispe');
      expect(admin.secondSurname).toBe('Rojas');
      expect(admin.dni).toBe('12345678');
      expect(admin.createdBy).toBe('SEED');
      expect(admin.userRoles.map((ur) => ur.role.code)).toEqual(['ADMINISTRATOR']);
      expect(admin.passwordHash).toMatch(/^\$argon2id\$/);
      expect(admin.passwordHash).not.toContain(PASSWORD);
      expect(await argon2.verify(admin.passwordHash as string, PASSWORD)).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'second run keeps the password, role edits and adds new permissions',
    async () => {
      const prisma = getPrisma();
      await seed(ADMIN_ENV);
      const before = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
      const baseline = await countRows();

      // Edición hecha desde Roles: se quita una concesión por defecto del rol TEACHER
      const teacher = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });
      const editedGrant = await prisma.rolePermission.findFirstOrThrow({
        where: { roleId: teacher.id },
      });
      await prisma.rolePermission.delete({ where: { id: editedGrant.id } });

      // Permiso «nuevo del código»: no existe aún en la base
      const newPermission = await prisma.permission.findFirstOrThrow({
        where: { rolePermissions: { some: { role: { code: 'ADMINISTRATOR' } } } },
        orderBy: { code: 'desc' },
      });
      await prisma.rolePermission.deleteMany({ where: { permissionId: newPermission.id } });
      await prisma.permission.delete({ where: { id: newPermission.id } });

      // Segunda ejecución con y sin las variables ADMIN_*
      await seed({});
      await seed(ADMIN_ENV);

      const after = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
      expect(after.id).toBe(before.id);
      expect(after.passwordHash).toBe(before.passwordHash);

      const counts = await countRows();
      expect(counts.users).toBe(baseline.users);
      expect(counts.userRoles).toBe(baseline.userRoles);
      expect(counts.roles).toBe(baseline.roles);
      expect(counts.permissions).toBe(baseline.permissions);

      // El catálogo no se duplica en la segunda ejecución
      expect(await prisma.catalogVersion.count()).toBe(1);
      expect(await prisma.educationalObjective.count()).toBe(4);
      expect(await prisma.graduateAttribute.count()).toBe(12);

      // Las plantillas tampoco se duplican
      expect(await prisma.template.count()).toBe(OFFICIAL_TEMPLATES.length);
      expect(await prisma.templateVersion.count()).toBe(OFFICIAL_TEMPLATES.length);

      // La edición no se revirtió
      const restoredEdit = await prisma.rolePermission.count({
        where: { roleId: teacher.id, permissionId: editedGrant.permissionId },
      });
      expect(restoredEdit).toBe(0);

      // El permiso nuevo se agregó con su concesión por defecto
      const recreated = await prisma.permission.findUniqueOrThrow({
        where: { code: newPermission.code },
      });
      const adminGrant = await prisma.rolePermission.count({
        where: { permissionId: recreated.id, role: { code: 'ADMINISTRATOR' } },
      });
      expect(adminGrant).toBe(1);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'fails without administrator and variables naming the variable and leaves no rows',
    async () => {
      const error = await seed({}).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BootstrapAdminConfigError);
      const message = (error as Error).message;
      for (const variable of [
        'ADMIN_EMAIL',
        'ADMIN_FULL_NAME',
        'ADMIN_DNI',
        'ADMIN_INITIAL_PASSWORD',
      ]) {
        expect(message).toContain(variable);
      }
      expect(await countRows()).toEqual({
        permissions: 0,
        roles: 0,
        rolePermissions: 0,
        users: 0,
        userRoles: 0,
        programs: 0,
      });
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'creates exactly one administrator when five seeds run concurrently',
    async () => {
      const prisma = getPrisma();

      const results = await Promise.allSettled(Array.from({ length: 5 }, () => seed(ADMIN_ENV)));

      expect(results.map((r) => r.status)).toEqual(Array(5).fill('fulfilled'));
      const counts = await countRows();
      expect(counts.users).toBe(1);
      expect(counts.userRoles).toBe(1);
      expect(counts.roles).toBe(5);
      expect(await prisma.userRole.count({ where: { role: { code: 'ADMINISTRATOR' } } })).toBe(1);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'rejects hostile values with a configuration error that omits the received value',
    async () => {
      const longPassword = `a1${'x'.repeat(127)}`;
      const longEmail = `${'a'.repeat(312)}@x.test`;

      const cases: Record<string, Record<string, string>> = {
        ADMIN_INITIAL_PASSWORD: { ...ADMIN_ENV, ADMIN_INITIAL_PASSWORD: longPassword },
        ADMIN_EMAIL: { ...ADMIN_ENV, ADMIN_EMAIL: longEmail },
        ADMIN_FULL_NAME: { ...ADMIN_ENV, ADMIN_FULL_NAME: '' },
      };

      for (const [variable, env] of Object.entries(cases)) {
        const error = (await seed(env).catch((e: unknown) => e)) as Error;
        expect(error).toBeInstanceOf(BootstrapAdminConfigError);
        expect(error.message).toContain(variable);
        expect(error.message).not.toContain(longPassword);
        expect(error.message).not.toContain(longEmail);
      }
      expect((await countRows()).users).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );

  it(
    'succeeds with an existing administrator and absent variables, and refuses a used email',
    async () => {
      const prisma = getPrisma();
      await seed(ADMIN_ENV);

      await expect(seed({ ADMIN_EMAIL: '', ADMIN_INITIAL_PASSWORD: '' })).resolves.toBeUndefined();

      // Sin administrador y con un correo que ya usa un usuario común: no se promueve la cuenta
      await prisma.userRole.deleteMany({});
      await prisma.user.updateMany({
        data: { email: 'otra.cuenta@example.test', dni: '87654321' },
      });
      const error = (await seed({
        ...ADMIN_ENV,
        ADMIN_EMAIL: 'otra.cuenta@example.test',
        ADMIN_DNI: '11112222',
      }).catch((e: unknown) => e)) as Error;

      expect(error).toBeInstanceOf(BootstrapAdminConflictError);
      expect(error.message).toContain('ADMIN_EMAIL');
      expect(error.message).not.toContain(PASSWORD);
      expect(await prisma.userRole.count()).toBe(0);
    },
    TEST_TIMEOUT_MS,
  );
});
