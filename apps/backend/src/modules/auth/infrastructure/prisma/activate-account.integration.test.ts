import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/db/use-test-database.js';
import { PrismaUnitOfWork } from '../../../../shared/prisma/prisma-unit-of-work.js';
import { PrismaUserRepository } from './prisma-user-repository.js';
import { PrismaActivationTokenRepository } from './prisma-activation-token-repository.js';
import { Argon2PasswordHasher } from '../security/argon2-password-hasher.js';
import { RandomActivationTokenGenerator } from '../security/random-activation-token-generator.js';
import { ActivateAccountUseCase } from '../../application/activate-account.js';
import { ActivationToken } from '../../domain/entities/activation-token.js';
import { InvalidActivationTokenError } from '../../domain/errors/index.js';
import type { AuditEvent, AuditLogger } from '../../../../shared/audit/audit-logger.js';

describe('ActivateAccountUseCase Integration (PostgreSQL real, Argon2 real, AGENTS §4.2, §9)', () => {
  const { getPrisma } = useTestDatabase();
  const prisma = getPrisma();
  const uow = new PrismaUnitOfWork(prisma);

  const userRepo = new PrismaUserRepository(uow);
  const tokenRepo = new PrismaActivationTokenRepository(uow);
  const passwordHasher = new Argon2PasswordHasher();
  const tokenGenerator = new RandomActivationTokenGenerator();

  const createPendingUser = async (email: string) => {
    return await prisma.user.create({
      data: {
        names: 'Integration',
        firstSurname: 'Pending',
        email,
        status: 'PENDING_ACTIVATION',
      },
    });
  };

  const createTokenForUser = async (userId: string, rawToken: string) => {
    const tokenHash = tokenGenerator.hash(rawToken);
    const token = ActivationToken.create({
      userId,
      tokenHash,
    });
    await tokenRepo.add(token);
    return token;
  };

  it('activates a pending user end to end and records the audit', async () => {
    const user = await createPendingUser('act-e2e-success@untrm.edu.pe');
    const rawToken = 'e2e-activation-token-raw-value-12345';
    await createTokenForUser(user.id, rawToken);

    const auditedEvents: AuditEvent[] = [];
    const auditLogger: AuditLogger = {
      log: async (event: AuditEvent) => {
        auditedEvents.push(event);
      },
    };

    const useCase = new ActivateAccountUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      activationTokenGenerator: tokenGenerator,
      passwordHasher,
      unitOfWork: uow,
      auditLogger,
    });

    const strongPassword = 'MySecurePassword2026*';
    const result = await useCase.execute({
      token: rawToken,
      password: strongPassword,
      ip: '10.0.0.42',
    });

    expect(result).toEqual({ status: 'ACTIVE' });

    // 1. Verificación del usuario en PostgreSQL
    const inDbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(inDbUser.status).toBe('ACTIVE');
    expect(inDbUser.passwordHash).not.toBeNull();

    // 2. Verificación de hash con Argon2 real
    const isPasswordValid = await passwordHasher.verify(strongPassword, inDbUser.passwordHash!);
    expect(isPasswordValid).toBe(true);

    // 3. Verificación del token en PostgreSQL
    const inDbToken = await tokenRepo.findByTokenHash(tokenGenerator.hash(rawToken));
    expect(inDbToken?.usedAt).not.toBeNull();

    // 4. Verificación de eventos de auditoría registrados
    expect(auditedEvents).toHaveLength(2);
    expect(auditedEvents[0]).toMatchObject({
      action: 'STATE_CHANGE',
      entity: 'User',
      entityId: user.id,
      actor: user.id,
      ip: '10.0.0.42',
      before: { status: 'PENDING_ACTIVATION' },
      after: { status: 'ACTIVE' },
    });
    expect(auditedEvents[1]).toMatchObject({
      action: 'STATE_CHANGE',
      entity: 'ActivationToken',
      actor: user.id,
      ip: '10.0.0.42',
      before: { usedAt: null },
    });
  });

  it('serializes concurrent activations and exactly one of N concurrent activations wins (AGENTS §4.2.7, §9)', async () => {
    const user = await createPendingUser('concurrent-activate-uc@untrm.edu.pe');
    const rawToken = 'concurrent-activate-raw-token-12345';
    await createTokenForUser(user.id, rawToken);

    const auditLogger: AuditLogger = {
      log: async () => {},
    };

    const useCase = new ActivateAccountUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      activationTokenGenerator: tokenGenerator,
      passwordHasher,
      unitOfWork: uow,
      auditLogger,
    });

    const N = 5;
    const strongPassword = 'ConcurrentPassword2026*';

    // Lanzar N peticiones en paralelo compitiendo por activar la misma cuenta
    const results = await Promise.allSettled(
      Array.from({ length: N }).map(async (_, idx) => {
        return useCase.execute({
          token: rawToken,
          password: strongPassword,
          ip: `192.168.1.${idx + 1}`,
        });
      }),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactamente 1 activación tiene éxito
    expect(fulfilled).toHaveLength(1);
    // Exactamente N - 1 activaciones concurrentes fallan con InvalidActivationTokenError
    expect(rejected).toHaveLength(N - 1);

    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect(rej.reason).toBeInstanceOf(InvalidActivationTokenError);
      }
    }

    // La cuenta quedó activa y el token usado en la base de datos
    const inDbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(inDbUser.status).toBe('ACTIVE');

    const inDbToken = await tokenRepo.findByTokenHash(tokenGenerator.hash(rawToken));
    expect(inDbToken?.usedAt).not.toBeNull();
  }, 30_000);

  it('concurrent activation and deactivation never leaves an active user without its consumed token', async () => {
    const user = await createPendingUser('race-deactivation@untrm.edu.pe');
    const rawToken = 'race-deactivation-raw-token-12345';
    await createTokenForUser(user.id, rawToken);

    const auditLogger: AuditLogger = {
      log: async () => {},
    };

    const useCase = new ActivateAccountUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      activationTokenGenerator: tokenGenerator,
      passwordHasher,
      unitOfWork: uow,
      auditLogger,
    });

    // Operación 1: caso de uso activar cuenta
    const activatePromise = useCase.execute({
      token: rawToken,
      password: 'RacePassword2026*',
    });

    // Operación 2: administrador inactiva la cuenta en paralelo
    const deactivatePromise = uow.run(async () => {
      // Intenta actualizar el usuario a INACTIVE
      await prisma.user.updateMany({
        where: { id: user.id },
        data: { status: 'INACTIVE' },
      });
    });

    await Promise.allSettled([activatePromise, deactivatePromise]);

    const inDbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const inDbToken = await tokenRepo.findByTokenHash(tokenGenerator.hash(rawToken));

    // Consistencia garantizada:
    // Si el usuario quedó ACTIVE, el token necesariamente fue consumido
    if (inDbUser.status === 'ACTIVE') {
      expect(inDbToken?.usedAt).not.toBeNull();
    }
  }, 30_000);

  it('rolls back the user and the token when the audit fails', async () => {
    const user = await createPendingUser('rollback-audit-fail@untrm.edu.pe');
    const rawToken = 'rollback-audit-fail-raw-token-12345';
    await createTokenForUser(user.id, rawToken);

    const failingAuditLogger: AuditLogger = {
      log: async () => {
        throw new Error('Database disk error in audit append');
      },
    };

    const useCase = new ActivateAccountUseCase({
      userRepository: userRepo,
      activationTokenRepository: tokenRepo,
      activationTokenGenerator: tokenGenerator,
      passwordHasher,
      unitOfWork: uow,
      auditLogger: failingAuditLogger,
    });

    await expect(
      useCase.execute({
        token: rawToken,
        password: 'RollbackPassword2026*',
      }),
    ).rejects.toThrow('Database disk error in audit append');

    // Estado en base de datos quedó revertido (atomicidad)
    const inDbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(inDbUser.status).toBe('PENDING_ACTIVATION');
    expect(inDbUser.passwordHash).toBeNull();

    const inDbToken = await tokenRepo.findByTokenHash(tokenGenerator.hash(rawToken));
    expect(inDbToken?.usedAt).toBeNull();
  });
});
