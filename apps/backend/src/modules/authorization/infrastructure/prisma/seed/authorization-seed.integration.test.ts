import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/db/use-test-database.js';
import { seedAuthorization } from './authorization-seed.js';

describe('Authorization Seed Integration (PostgreSQL real, CA1, RS-010, LS 3.2, LS 3.3, D4, D6)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  it('seed creates the five roles, the catalog and the default matrix', async () => {
    await seedAuthorization(prisma);

    // 1. Verificar los 5 roles predefinidos
    const roles = await prisma.role.findMany({
      orderBy: { code: 'asc' },
    });
    expect(roles).toHaveLength(5);
    const roleCodes = roles.map((r) => r.code);
    expect(roleCodes).toEqual([
      'ADMINISTRATOR',
      'COMMITTEE_MEMBER',
      'COMMITTEE_PRESIDENT',
      'PROGRAM_DIRECTOR',
      'TEACHER',
    ]);

    for (const role of roles) {
      expect(role.status).toBe('ACTIVE');
      expect(role.deactivatedAt).toBeNull();
      expect(role.isPredefined).toBe(true);
    }

    // 2. Verificar los 72 permisos del catálogo
    const permissions = await prisma.permission.findMany({
      orderBy: { code: 'asc' },
    });
    expect(permissions).toHaveLength(72);

    // 3. Verificar las concesiones de la matriz
    const grants = await prisma.rolePermission.findMany({
      include: { role: true, permission: true },
    });
    expect(grants).toHaveLength(174); // 35 + 59 + 41 + 21 + 18

    const adminGrants = grants.filter((g) => g.role.code === 'ADMINISTRATOR');
    expect(adminGrants).toHaveLength(35);
    expect(adminGrants.every((g) => g.scope === 'GLOBAL')).toBe(true);

    const presGrants = grants.filter((g) => g.role.code === 'COMMITTEE_PRESIDENT');
    expect(presGrants).toHaveLength(59);
    expect(presGrants.every((g) => g.scope === 'GLOBAL')).toBe(true);

    const memberGrants = grants.filter((g) => g.role.code === 'COMMITTEE_MEMBER');
    expect(memberGrants).toHaveLength(41);
    expect(memberGrants.every((g) => g.scope === 'GLOBAL')).toBe(true);

    const directorGrants = grants.filter((g) => g.role.code === 'PROGRAM_DIRECTOR');
    expect(directorGrants).toHaveLength(21);
    expect(directorGrants.every((g) => g.scope === 'GLOBAL')).toBe(true);

    const teacherGrants = grants.filter((g) => g.role.code === 'TEACHER');
    expect(teacherGrants).toHaveLength(18);
    expect(teacherGrants.filter((g) => g.scope === 'GLOBAL')).toHaveLength(5);
    expect(teacherGrants.filter((g) => g.scope === 'OWN')).toHaveLength(13);
  });

  it('seed is idempotent when executed multiple times', async () => {
    await seedAuthorization(prisma);
    const countRoles1 = await prisma.role.count();
    const countPerms1 = await prisma.permission.count();
    const countGrants1 = await prisma.rolePermission.count();

    // Segunda ejecución
    await seedAuthorization(prisma);
    const countRoles2 = await prisma.role.count();
    const countPerms2 = await prisma.permission.count();
    const countGrants2 = await prisma.rolePermission.count();

    expect(countRoles2).toBe(countRoles1);
    expect(countPerms2).toBe(countPerms1);
    expect(countGrants2).toBe(countGrants1);
  });

  it('rerunning the seed keeps edited grants and role names', async () => {
    await seedAuthorization(prisma);

    // 1. Editar el nombre de un rol
    const teacherRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'TEACHER' },
    });
    await prisma.role.update({
      where: { id: teacherRole.id },
      data: {
        name: 'Docente Modificado por Admin',
        description: 'Descripción personalizada',
      },
    });

    // 2. Modificar el alcance de una concesión existente del Administrador (ej. de GLOBAL a OWN)
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMINISTRATOR' },
    });
    const userVerPerm = await prisma.permission.findUniqueOrThrow({
      where: { code: 'usuario.ver' },
    });
    const adminGrant = await prisma.rolePermission.findUniqueOrThrow({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: userVerPerm.id,
        },
      },
    });
    await prisma.rolePermission.update({
      where: { id: adminGrant.id },
      data: { scope: 'OWN' },
    });

    // 3. Eliminar una concesión existente del Administrador (ej. rol.ver)
    const rolVerPerm = await prisma.permission.findUniqueOrThrow({
      where: { code: 'rol.ver' },
    });
    await prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: rolVerPerm.id,
        },
      },
    });

    // Re-ejecutar la semilla
    await seedAuthorization(prisma);

    // Verificar que los cambios del Administrador no se hayan pisado
    const teacherAfter = await prisma.role.findUniqueOrThrow({
      where: { code: 'TEACHER' },
    });
    expect(teacherAfter.name).toBe('Docente Modificado por Admin');
    expect(teacherAfter.description).toBe('Descripción personalizada');

    const adminGrantAfter = await prisma.rolePermission.findUniqueOrThrow({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: userVerPerm.id,
        },
      },
    });
    expect(adminGrantAfter.scope).toBe('OWN');

    const deletedGrantAfter = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: rolVerPerm.id,
        },
      },
    });
    expect(deletedGrantAfter).toBeNull();
  });

  it('seed grants a newly added catalog permission to the roles that hold it by default', async () => {
    await seedAuthorization(prisma);

    // Simular que un permiso no existía: borrar 'documento.descargar' y sus concesiones
    const docPerm = await prisma.permission.findUniqueOrThrow({
      where: { code: 'documento.descargar' },
    });
    await prisma.rolePermission.deleteMany({
      where: { permissionId: docPerm.id },
    });
    await prisma.permission.delete({
      where: { id: docPerm.id },
    });

    // Re-ejecutar la semilla
    await seedAuthorization(prisma);

    // El permiso debe recrearse y concederse a los roles que lo tienen por defecto
    const recreatedPerm = await prisma.permission.findUnique({
      where: { code: 'documento.descargar' },
    });
    expect(recreatedPerm).not.toBeNull();

    const grantsForDoc = await prisma.rolePermission.findMany({
      where: { permissionId: recreatedPerm!.id },
      include: { role: true },
    });
    // Según LS 3.3, los 5 roles tienen documento.descargar
    expect(grantsForDoc).toHaveLength(5);
  });

  it('seed marks created rows with SEED', async () => {
    await seedAuthorization(prisma);

    const roles = await prisma.role.findMany();
    for (const r of roles) {
      expect(r.createdBy).toBe('SEED');
    }

    const permissions = await prisma.permission.findMany();
    for (const p of permissions) {
      expect(p.createdBy).toBe('SEED');
    }

    const grants = await prisma.rolePermission.findMany();
    for (const g of grants) {
      expect(g.createdBy).toBe('SEED');
    }
  });

  it('restores the predefined matrix and removes manual roles while keeping direct permissions', async () => {
    await seedAuthorization(prisma);

    const user = await prisma.user.create({
      data: {
        email: 'restore-test@example.test',
        names: 'Ana',
        firstSurname: 'Torres',
        status: 'ACTIVE',
        createdBy: 'SEED',
      },
    });
    const manualRole = await prisma.role.create({
      data: {
        code: 'CUSTOM_TESTER',
        name: 'Tester Manual',
        description: 'Rol temporal',
        isPredefined: false,
        status: 'ACTIVE',
        createdBy: user.id,
      },
    });
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });
    const rolVerPerm = await prisma.permission.findUniqueOrThrow({ where: { code: 'rol.ver' } });
    const docPerm = await prisma.permission.findUniqueOrThrow({
      where: { code: 'documento.descargar' },
    });

    await prisma.userRole.createMany({
      data: [
        { userId: user.id, roleId: manualRole.id, createdBy: 'SEED' },
        { userId: user.id, roleId: adminRole.id, createdBy: 'SEED' },
      ],
    });
    await prisma.userPermission.create({
      data: { userId: user.id, permissionId: docPerm.id, scope: 'GLOBAL', createdBy: 'SEED' },
    });
    await prisma.rolePermission.create({
      data: {
        roleId: manualRole.id,
        permissionId: rolVerPerm.id,
        scope: 'GLOBAL',
        createdBy: user.id,
      },
    });
    await prisma.rolePermission.delete({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: rolVerPerm.id } },
    });
    await prisma.role.update({
      where: { id: adminRole.id },
      data: { name: 'Nombre Alterado', status: 'INACTIVE' },
    });

    await seedAuthorization(prisma, { restorePredefined: true });
    // Idempotente en segunda ejecución
    await seedAuthorization(prisma, { restorePredefined: true });

    const rolesAfter = await prisma.role.findMany();
    expect(rolesAfter).toHaveLength(5);
    expect(rolesAfter.some((r) => r.code === 'CUSTOM_TESTER')).toBe(false);

    const restoredAdmin = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMINISTRATOR' } });
    expect(restoredAdmin.name).toBe('Administrador');
    expect(restoredAdmin.status).toBe('ACTIVE');

    const restoredGrant = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: rolVerPerm.id } },
    });
    expect(restoredGrant).not.toBeNull();

    expect(await prisma.userRole.findMany({ where: { userId: user.id } })).toHaveLength(1);
    expect(await prisma.userPermission.findMany({ where: { userId: user.id } })).toHaveLength(1);
  });

  it('keeps the default behavior without the option', async () => {
    await seedAuthorization(prisma);
    await prisma.role.create({
      data: {
        code: 'CUSTOM_KEEP',
        name: 'Rol Conservado',
        description: 'Manual',
        isPredefined: false,
        status: 'ACTIVE',
        createdBy: 'SEED',
      },
    });

    await seedAuthorization(prisma);
    expect(await prisma.role.findUnique({ where: { code: 'CUSTOM_KEEP' } })).not.toBeNull();
  });
});
