import { describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaUserRepository } from '../infrastructure/prisma/prisma-user-repository.js';
import { CreateUserUseCase } from './create-user.js';
import type {
  ActivationEmailSender,
  ActivationTokenIssuer,
  PermissionChecker,
  UserRoleGateway,
} from '../domain/ports/index.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import { UserEmailAlreadyExistsError } from '../domain/errors/index.js';

describe('CreateUserUseCase Integration Race (PostgreSQL real)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);
  const userRepo = new PrismaUserRepository(uow);

  it('exactly one of N simultaneous creations with the same email succeeds and the rest fail with 409', async () => {
    const sharedEmail = 'race.create.user@untrm.edu.pe';
    const N = 4;

    const permissionChecker: PermissionChecker = {
      assertAllowed: vi.fn().mockResolvedValue(undefined),
    };
    const userRoleGateway: UserRoleGateway = {
      replaceRoles: vi.fn().mockResolvedValue(undefined),
      getRoleIds: vi.fn().mockResolvedValue(new Map()),
    };
    const activationTokenIssuer: ActivationTokenIssuer = {
      issue: vi.fn().mockResolvedValue({
        token: 'token-race-test',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48),
      }),
    };
    const activationEmailSender: ActivationEmailSender = {
      send: vi.fn().mockResolvedValue(undefined),
    };
    const auditLogger: AuditLogger = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    const useCase = new CreateUserUseCase({
      userRepository: userRepo,
      permissionChecker,
      userRoleGateway,
      activationTokenIssuer,
      activationEmailSender,
      unitOfWork: uow,
      auditLogger,
    });

    const requests = Array.from({ length: N }, (_, i) =>
      useCase.execute({
        actorId: `admin-${i}`,
        ip: `192.168.1.${i + 10}`,
        input: {
          names: `Race User ${i}`,
          firstSurname: 'Simultaneous',
          email: sharedEmail,
          dni: `8765434${i}`,
          roleIds: ['role-race-id'],
        },
      }),
    );

    const results = await Promise.allSettled(requests);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(N - 1);

    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect(rej.reason).toBeInstanceOf(UserEmailAlreadyExistsError);
      }
    }

    const inDb = await prisma.user.findMany({
      where: { email: sharedEmail },
    });
    expect(inDb).toHaveLength(1);
  }, 15_000);
});
