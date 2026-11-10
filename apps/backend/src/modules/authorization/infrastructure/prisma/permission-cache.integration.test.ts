import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { createPrismaAuditServices } from '../../../../shared/prisma/create-prisma-audit-services.js';
import { seedAuthorizationFast } from '../../../../test/factories/authorization.js';
import { createAuthenticatedActor } from '../../../../test/http/authenticated-actor.js';
import { PrismaRoleRepository } from './prisma-role-repository.js';
import { PrismaPermissionRepository } from './prisma-permission-repository.js';
import { PrismaRolePermissionRepository } from './prisma-role-permission-repository.js';
import { PrismaRoleReader } from './prisma-role-reader.js';
import { PrismaGrantReader } from './prisma-grant-reader.js';
import { PrismaUserAccessSubjectRepository } from './prisma-user-access-subject-repository.js';
import { PrismaUserRoleRepository } from './prisma-user-role-repository.js';
import { PrismaUserPermissionRepository } from './prisma-user-permission-repository.js';
import { CachingGrantReader } from '../cache/caching-grant-reader.js';
import { PermissionAuthorizer } from '../../application/permission-authorizer.js';
import { EditRolePermissionsUseCase } from '../../application/edit-role-permissions.js';
import { ChangeRoleStatusUseCase } from '../../application/change-role-status.js';
import { AssignUserRolesUseCase } from '../../application/assign-user-roles.js';
import { AssignUserPermissionsUseCase } from '../../application/assign-user-permissions.js';
import { UserAccessAssembler } from '../../application/user-access-assembler.js';

describe('Permission Cache Integration (PostgreSQL real, HU-007, T-007-09, CA1, RS-012, RS-020, RNF-017, D1, D2, D3, D4, D6, D10)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  const uow = new PrismaUnitOfWork(prisma);
  const auditServices = createPrismaAuditServices(uow);
  const roleRepo = new PrismaRoleRepository(uow);
  const permissionRepo = new PrismaPermissionRepository(uow);
  const rolePermissionRepo = new PrismaRolePermissionRepository(uow);
  const roleReader = new PrismaRoleReader(uow);
  const underlyingGrantReader = new PrismaGrantReader(uow);
  const cachingGrantReader = new CachingGrantReader(underlyingGrantReader, uow);
  const authorizer = new PermissionAuthorizer(cachingGrantReader);

  const subjectRepo = new PrismaUserAccessSubjectRepository(uow);
  const userRoleRepo = new PrismaUserRoleRepository(uow);
  const userPermissionRepo = new PrismaUserPermissionRepository(uow);
  const assembler = new UserAccessAssembler({
    roles: userRoleRepo,
    direct: userPermissionRepo,
    rolePermissions: rolePermissionRepo,
  });

  const editRolePermissionsUseCase = new EditRolePermissionsUseCase({
    roleRepository: roleRepo,
    permissionRepository: permissionRepo,
    rolePermissionRepository: rolePermissionRepo,
    roleReader,
    authorizer,
    unitOfWork: uow,
    auditLogger: auditServices.auditLogger,
    permissionCache: cachingGrantReader,
  });

  const changeRoleStatusUseCase = new ChangeRoleStatusUseCase({
    roleRepository: roleRepo,
    roleReader,
    authorizer,
    unitOfWork: uow,
    auditLogger: auditServices.auditLogger,
    permissionCache: cachingGrantReader,
  });

  const assignUserRolesUseCase = new AssignUserRolesUseCase({
    subject: subjectRepo,
    roles: userRoleRepo,
    roleRepository: roleRepo,
    authorizer,
    assembler,
    unitOfWork: uow,
    auditLogger: auditServices.auditLogger,
    permissionCache: cachingGrantReader,
  });

  const assignUserPermissionsUseCase = new AssignUserPermissionsUseCase({
    subject: subjectRepo,
    direct: userPermissionRepo,
    permissionRepository: permissionRepo,
    authorizer,
    assembler,
    unitOfWork: uow,
    auditLogger: auditServices.auditLogger,
    permissionCache: cachingGrantReader,
  });

  let adminActorId: string;

  beforeEach(async () => {
    cachingGrantReader.invalidateAll();
    await seedAuthorizationFast(prisma);

    const admin = await createAuthenticatedActor({
      prisma,
      roles: ['ADMINISTRATOR'],
    });
    adminActorId = admin.user.id;
  });

  it('queries the database once for 20 simultaneous requests of the same user', async () => {
    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });
    const user = await prisma.user.create({
      data: {
        names: 'Docente',
        firstSurname: 'Concurrente',
        email: `teacher_concurrent_${Date.now()}@unterm.edu.pe`,
        status: 'ACTIVE',
      },
    });
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: teacherRole.id,
      },
    });

    const spyUnderlying = vi.spyOn(underlyingGrantReader, 'findGrantsByUserId');

    const requests = Array.from({ length: 20 }, () =>
      cachingGrantReader.findGrantsByUserId(user.id),
    );
    const results = await Promise.all(requests);

    expect(spyUnderlying).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(20);
    for (const grants of results) {
      expect(grants.length).toBeGreaterThan(0);
      expect(grants.some((g) => g.permission === 'academico.ver')).toBe(true);
    }

    spyUnderlying.mockRestore();
  });

  it('applies a role permission edit on the next request', async () => {
    const uniqueSuffix = `${Date.now()}_${Math.random()}`;
    const customRole = await prisma.role.create({
      data: {
        code: `ROL_CACHE_${uniqueSuffix.replace('.', '_')}`.slice(0, 30),
        name: `Rol Cache ${uniqueSuffix}`.slice(0, 50),
        status: 'ACTIVE',
        isPredefined: false,
        createdBy: adminActorId,
      },
    });

    const user = await prisma.user.create({
      data: {
        names: 'Usuario',
        firstSurname: 'RoleEdit',
        email: `role_edit_${Date.now()}@unterm.edu.pe`,
        status: 'ACTIVE',
      },
    });
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: customRole.id,
      },
    });

    // Inicialmente no tiene permisos
    const initialGrants = await cachingGrantReader.findGrantsByUserId(user.id);
    expect(initialGrants).toEqual([]);

    // Modificamos los permisos del rol mediante el caso de uso
    await editRolePermissionsUseCase.execute({
      actorId: adminActorId,
      roleId: customRole.id,
      input: {
        permissions: [{ permissionCode: 'rol.ver', scope: 'GLOBAL' }],
      },
    });

    // La siguiente llamada debe reflejar los nuevos permisos (caché invalidada)
    const nextGrants = await cachingGrantReader.findGrantsByUserId(user.id);
    expect(nextGrants).toEqual([
      expect.objectContaining({ permission: 'rol.ver', scope: 'GLOBAL' }),
    ]);
  });

  it('applies a role status change on the next request', async () => {
    const uniqueSuffix = `${Date.now()}_${Math.random()}`;
    const customRole = await prisma.role.create({
      data: {
        code: `ROL_STAT_${uniqueSuffix.replace('.', '_')}`.slice(0, 30),
        name: `Rol Status ${uniqueSuffix}`.slice(0, 50),
        status: 'ACTIVE',
        isPredefined: false,
        createdBy: adminActorId,
      },
    });

    const perm = await prisma.permission.findUniqueOrThrow({ where: { code: 'usuario.ver' } });
    await prisma.rolePermission.create({
      data: {
        roleId: customRole.id,
        permissionId: perm.id,
        scope: 'GLOBAL',
      },
    });

    const user = await prisma.user.create({
      data: {
        names: 'Usuario',
        firstSurname: 'StatusChange',
        email: `status_change_${Date.now()}@unterm.edu.pe`,
        status: 'ACTIVE',
      },
    });
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: customRole.id,
      },
    });

    // Tiene usuario.ver activo
    const grantsActive = await cachingGrantReader.findGrantsByUserId(user.id);
    expect(grantsActive).toEqual([
      expect.objectContaining({ permission: 'usuario.ver', scope: 'GLOBAL' }),
    ]);

    // Desactivamos el rol
    await changeRoleStatusUseCase.execute({
      actorId: adminActorId,
      roleId: customRole.id,
      input: { status: 'INACTIVE', confirmed: true },
    });

    // En la siguiente petición, al estar inactivo, no otorga permisos
    const grantsInactive = await cachingGrantReader.findGrantsByUserId(user.id);
    expect(grantsInactive).toEqual([]);
  });

  it('applies user role assignment on the next request', async () => {
    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });
    const user = await prisma.user.create({
      data: {
        names: 'Usuario',
        firstSurname: 'UserRoleAssign',
        email: `user_role_${Date.now()}@unterm.edu.pe`,
        status: 'ACTIVE',
      },
    });

    // Inicialmente sin roles
    const initialGrants = await cachingGrantReader.findGrantsByUserId(user.id);
    expect(initialGrants).toEqual([]);

    // Asignamos rol TEACHER
    await assignUserRolesUseCase.execute({
      actorId: adminActorId,
      userId: user.id,
      input: { roleIds: [teacherRole.id] },
    });

    // La siguiente petición ve las concesiones del rol asignado
    const updatedGrants = await cachingGrantReader.findGrantsByUserId(user.id);
    expect(updatedGrants.some((g) => g.permission === 'academico.ver')).toBe(true);
  });

  it('applies direct user permissions assignment on the next request', async () => {
    const user = await prisma.user.create({
      data: {
        names: 'Usuario',
        firstSurname: 'UserDirectPerm',
        email: `user_direct_${Date.now()}@unterm.edu.pe`,
        status: 'ACTIVE',
      },
    });

    const initialGrants = await cachingGrantReader.findGrantsByUserId(user.id);
    expect(initialGrants).toEqual([]);

    // Asignamos permiso directo usuario.ver OWN
    await assignUserPermissionsUseCase.execute({
      actorId: adminActorId,
      userId: user.id,
      input: {
        permissions: [{ permissionCode: 'usuario.ver', scope: 'OWN' }],
      },
    });

    // La siguiente llamada refleja el permiso directo asignado
    const updatedGrants = await cachingGrantReader.findGrantsByUserId(user.id);
    expect(updatedGrants).toEqual([
      expect.objectContaining({ permission: 'usuario.ver', scope: 'OWN' }),
    ]);
  });
}, 30_000);
