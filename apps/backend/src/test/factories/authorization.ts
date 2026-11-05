import type { PrismaClient } from '../../shared/prisma/generated/client.js';
import { seedAuthorization } from '../../modules/authorization/infrastructure/prisma/seed/authorization-seed.js';

export { seedAuthorization };

export async function grantRole(
  prisma: PrismaClient,
  userId: string,
  roleCode: string,
): Promise<void> {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: roleCode },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId,
      roleId: role.id,
      createdBy: 'FACTORY',
    },
  });
}
