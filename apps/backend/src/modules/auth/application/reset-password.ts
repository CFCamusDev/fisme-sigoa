import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { PasswordPolicy } from '../domain/value-objects/password-policy.js';
import {
  InvalidActivationTokenError,
  InvalidPasswordResetTokenError,
  UserNotActiveError,
} from '../domain/errors/index.js';
import type {
  ActivationTokenGenerator,
  ActivationTokenRepository,
  PasswordHasher,
  RefreshTokenRepository,
  UserRepository,
} from '../domain/ports/index.js';
import type { ResetPasswordCommand, ResetPasswordResult } from './reset-password.types.js';

export interface ResetPasswordUseCaseDependencies {
  userRepository: UserRepository;
  activationTokenRepository: ActivationTokenRepository;
  refreshTokenRepository: RefreshTokenRepository;
  activationTokenGenerator: ActivationTokenGenerator;
  passwordHasher: PasswordHasher;
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
  clock?: () => Date;
}

export class ResetPasswordUseCase {
  private readonly userRepository: UserRepository;
  private readonly activationTokenRepository: ActivationTokenRepository;
  private readonly refreshTokenRepository: RefreshTokenRepository;
  private readonly activationTokenGenerator: ActivationTokenGenerator;
  private readonly passwordHasher: PasswordHasher;
  private readonly unitOfWork: UnitOfWork;
  private readonly auditLogger: AuditLogger;
  private readonly clock: () => Date;

  constructor(deps: ResetPasswordUseCaseDependencies) {
    this.userRepository = deps.userRepository;
    this.activationTokenRepository = deps.activationTokenRepository;
    this.refreshTokenRepository = deps.refreshTokenRepository;
    this.activationTokenGenerator = deps.activationTokenGenerator;
    this.passwordHasher = deps.passwordHasher;
    this.unitOfWork = deps.unitOfWork;
    this.auditLogger = deps.auditLogger;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: ResetPasswordCommand): Promise<ResetPasswordResult> {
    const now = this.clock();

    // 1. Validación de política de contraseña primero (los incumplimientos no revelan nada del token)
    PasswordPolicy.assert(command.password);

    // 2. Hash del token y comprobación previa rápida fuera de la transacción
    const tokenHash = this.activationTokenGenerator.hash(command.token);
    const preCheckToken = await this.activationTokenRepository.findByTokenHash(tokenHash);
    if (!preCheckToken || !preCheckToken.isUsable(now)) {
      throw new InvalidPasswordResetTokenError();
    }

    // Comprobación previa del usuario para evitar hashing costoso con tokens de usuario inactivo (D8)
    const preCheckUser = await this.userRepository.findById(preCheckToken.userId);
    if (!preCheckUser || preCheckUser.status !== 'ACTIVE') {
      throw new InvalidPasswordResetTokenError();
    }

    // 3. Hashing de contraseña con argon2 fuera de la transacción (sin retener bloqueos en BD)
    const passwordHash = await this.passwordHasher.hash(command.password);

    // 4. Transacción atómica de restablecimiento, consumo, revocación y auditoría
    try {
      await this.unitOfWork.run(async () => {
        // Orden de bloqueo usuario -> token (D3) para evitar interbloqueo con solicitudes simultáneas
        const user = await this.userRepository.findByIdForUpdate(preCheckToken.userId);
        if (!user || user.status !== 'ACTIVE') {
          throw new InvalidPasswordResetTokenError();
        }

        const token = await this.activationTokenRepository.findByTokenHashForUpdate(tokenHash);
        if (!token || !token.isUsable(now) || token.userId !== user.id) {
          throw new InvalidPasswordResetTokenError();
        }

        // Transiciones en el dominio
        token.consume(now);
        user.resetPassword(passwordHash, now);

        // Persistencia condicional
        await this.userRepository.savePasswordReset(user);
        await this.activationTokenRepository.save(token);

        // Revocar tokens de recuperación pendientes y todas las sesiones activas del usuario
        await this.activationTokenRepository.revokePendingByUserId(user.id, now);
        const sessionsRevoked = await this.refreshTokenRepository.revokeAllForUser(user.id, now);

        // Auditoría en la misma transacción (User y ActivationToken)
        await this.auditLogger.log({
          action: 'UPDATE',
          entity: 'User',
          entityId: user.id,
          actor: user.id,
          ip: command.ip ?? undefined,
          after: {
            passwordChanged: true,
            sessionsRevoked,
          },
        });

        await this.auditLogger.log({
          action: 'STATE_CHANGE',
          entity: 'ActivationToken',
          entityId: token.id,
          actor: user.id,
          ip: command.ip ?? undefined,
          before: {
            usedAt: null,
          },
          after: {
            usedAt: token.usedAt?.toISOString() ?? now.toISOString(),
          },
        });
      });
    } catch (error: unknown) {
      if (error instanceof InvalidActivationTokenError || error instanceof UserNotActiveError) {
        throw new InvalidPasswordResetTokenError();
      }
      throw error;
    }

    return {
      status: 'PASSWORD_RESET',
    };
  }
}
