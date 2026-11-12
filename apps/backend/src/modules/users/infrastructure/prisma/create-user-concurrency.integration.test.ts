import { describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaUserRepository } from './prisma-user-repository.js';
import { CreateUserUseCase } from '../../application/create-user.js';
import type {
  ActivationEmailSender,
  ActivationTokenIssuer,
  PermissionChecker,
  UserRoleGateway,
} from '../../domain/ports/index.js';
import type { AuditLogger } from '../../../../shared/audit/audit-logger.js';
import { UserEmailAlreadyExistsError } from '../../domain/errors/index.js';

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
        token: 'hashed-token',
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
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

    // Lanzar N creaciones simultáneas compitiendo por el mismo email
    const start = Date.now();
    const attempts = Array.from({ length: N }, (_, index) =>
      useCase
        .execute({
          actorId: 'admin-actor-uuid',
          ip: '127.0.0.1',
          input: {
            names: `User ${index}`,
            firstSurname: 'Pérez',
            secondSurname: 'Gómez',
            email: sharedEmail,
            dni: `7766554${index}`,
            roleIds: ['role-admin-uuid'],
          },
        })
        .then(() => ({ success: true, error: null }))
        .catch((error) => ({ success: false, error })),
    );

    const results = await Promise.all(attempts);
    const elapsed = Date.now() - start;

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    // Exactamente 1 debe ganar la carrera atómica
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(N - 1);

    // Los N-1 perdedores deben fallar con UserEmailAlreadyExistsError (409)
    for (const failure of failures) {
      expect(failure.error).toBeInstanceOf(UserEmailAlreadyExistsError);
    }

    // Comprobación estricta de tiempo de carrera < 15 segundos
    expect(elapsed).toBeLessThan(15000);
  });
});
