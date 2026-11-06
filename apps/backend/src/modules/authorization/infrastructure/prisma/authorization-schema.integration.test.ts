import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';

describe('Authorization Schema Integration (PostgreSQL real, F1)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();

  async function createBaseEntities(suffix: string) {
    const user = await prisma.user.create({
      data: {
        names: 'Test',
        firstSurname: 'User',
        email: `auth.schema.${suffix}@untrm.edu.pe`,
        dni: suffix.slice(0, 8),
        status: 'ACTIVE',
      },
    });

    const role = await prisma.role.create({
      data: {
        code: `ROLE_${suffix.toUpperCase()}`,
        name: `Rol de prueba ${suffix}`,
        description: 'Descripción de prueba',
        isPredefined: false,
      },
    });

    const permission = await prisma.permission.create({
      data: {
        code: `test_${suffix}.action`,
        description: 'Permiso de prueba',
        module: 'M01 Seguridad',
      },
    });

    return { user, role, permission };
  }

  it('prevents a duplicated role permission pair', async () => {
    const { role, permission } = await createBaseEntities('dup_rp');

    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id,
        scope: 'GLOBAL',
      },
    });

    // Intentar duplicar la misma tupla [roleId, permissionId] debe fallar por clave única
    await expect(
      prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
          scope: 'OWN',
        },
      }),
    ).rejects.toThrow();
  });

  it('prevents a duplicated user role pair', async () => {
    const { user, role } = await createBaseEntities('dup_ur');

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    // Intentar duplicar la misma tupla [userId, roleId] debe fallar por clave única
    await expect(
      prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: role.id,
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects unknown foreign keys', async () => {
    const { role, user } = await createBaseEntities('fk_err');

    // Clave foránea inexistente en roleId para userRole
    await expect(
      prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: 'non-existent-role-id',
        },
      }),
    ).rejects.toThrow();

    // Clave foránea inexistente en permissionId para rolePermission
    await expect(
      prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: 'non-existent-permission-id',
        },
      }),
    ).rejects.toThrow();
  });

  it('does not allow deleting an assigned role (onDelete Restrict)', async () => {
    const { user, role } = await createBaseEntities('restrict');

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

    // Intentar borrar un rol asignado a un usuario debe ser rechazado por Restrict
    await expect(
      prisma.role.delete({
        where: { id: role.id },
      }),
    ).rejects.toThrow();
  });

  describe('Role Status and Deactivation (T-006-03, RF-006, RS-013)', () => {
    it('defaults a new role to ACTIVE and deactivatedAt to null', async () => {
      const code = `ROLE_STATUS_DEF_${Date.now()}`;
      const role = await prisma.role.create({
        data: {
          code,
          name: `Rol con estado por defecto ${Date.now()}`,
          isPredefined: false,
        },
      });

      expect(role.status).toBe('ACTIVE');
      expect(role.deactivatedAt).toBeNull();
    });

    it('rejects an unknown role status at database level', async () => {
      await expect(
        prisma.$executeRaw`
          INSERT INTO "roles" ("id", "code", "name", "status", "createdAt", "updatedAt")
          VALUES (${`role_err_${Date.now()}`}, ${`CODE_ERR_${Date.now()}`}, 'Err Status', 'INVALID_STATUS'::"RoleStatus", NOW(), NOW())
        `,
      ).rejects.toThrow();
    });

    it('has an index on role status', async () => {
      const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'roles' AND indexname = 'roles_status_idx'
      `;

      expect(indexes).toHaveLength(1);
      expect(indexes[0]?.indexdef).toContain('status');
    });

    it('updates role status to INACTIVE with deactivatedAt timestamp', async () => {
      const role = await prisma.role.create({
        data: {
          code: `ROLE_DEACT_${Date.now()}`,
          name: `Rol para desactivar ${Date.now()}`,
          isPredefined: false,
        },
      });

      const now = new Date();
      const updated = await prisma.role.update({
        where: { id: role.id },
        data: {
          status: 'INACTIVE',
          deactivatedAt: now,
        },
      });

      expect(updated.status).toBe('INACTIVE');
      expect(updated.deactivatedAt).toBeDefined();
      expect(updated.deactivatedAt?.getTime()).toBeCloseTo(now.getTime(), -2);
    });
  });

  describe('Permission Code Format Database Check (T-006-04, RS-010)', () => {
    it('rejects a permission code with uppercase letters, spaces or no dot', async () => {
      const invalidCodes = [
        'USUARIO.VER',
        'usuario.VER',
        'usuario ver',
        'usuariover',
        'usuario..ver',
        'usuario_._ver',
        '_usuario.ver',
        'usuario._ver',
        'usuario.ver_',
        'usuario.ver123',
      ];

      for (const invalidCode of invalidCodes) {
        await expect(
          prisma.permission.create({
            data: {
              code: invalidCode,
              description: 'Permiso inválido',
              module: 'M01 Seguridad',
            },
          }),
        ).rejects.toThrow(/permissions_code_format_check/);
      }
    });

    it('accepts codes with underscores such as plan_assessment.ver and acta.enviar_revision', async () => {
      const alphaSuffix =
        Math.random()
          .toString(36)
          .replace(/[^a-z]/g, '')
          .slice(0, 6) || 'abc';
      const validCodes = [
        `plan_assessment_${alphaSuffix}.ver`,
        `acta_${alphaSuffix}.enviar_revision`,
        `accion_mejora_${alphaSuffix}.avanzar`,
      ];

      for (const validCode of validCodes) {
        const created = await prisma.permission.create({
          data: {
            code: validCode,
            description: 'Permiso válido con guiones bajos',
            module: 'M10 Evaluación',
          },
        });
        expect(created.code).toBe(validCode);
      }
    });
  });

  describe('RolePermission Update Tracking (T-006-05, RS-013, RNF-022)', () => {
    it('sets updatedAt and keeps updatedBy null on a new grant', async () => {
      const suffix = `track_${Math.random()
        .toString(36)
        .replace(/[^a-z]/g, '')
        .slice(0, 5)}`;
      const { role, permission } = await createBaseEntities(suffix);

      const grant = await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
          scope: 'GLOBAL',
        },
      });

      expect(grant.createdAt).toBeInstanceOf(Date);
      expect(grant.updatedAt).toBeInstanceOf(Date);
      expect(grant.updatedBy).toBeNull();
      expect(grant.updatedAt.getTime()).toBeCloseTo(grant.createdAt.getTime(), -2);
    });

    it('refreshes updatedAt and records updatedBy when grant scope is updated', async () => {
      const suffix = `scope_${Math.random()
        .toString(36)
        .replace(/[^a-z]/g, '')
        .slice(0, 5)}`;
      const { role, permission } = await createBaseEntities(suffix);

      const grant = await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
          scope: 'GLOBAL',
        },
      });

      const updated = await prisma.rolePermission.update({
        where: { id: grant.id },
        data: {
          scope: 'OWN',
          updatedBy: 'admin-user-id',
        },
      });

      expect(updated.scope).toBe('OWN');
      expect(updated.updatedBy).toBe('admin-user-id');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(grant.updatedAt.getTime());
    });
  });
});
