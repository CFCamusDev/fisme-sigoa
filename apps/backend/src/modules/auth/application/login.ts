import { UnauthorizedError } from '../../../shared/errors/app-error.js';
import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import {
  AccountInactiveError,
  AccountLockedError,
  AccountPendingActivationError,
} from '../domain/errors/index.js';
import { RefreshToken } from '../domain/entities/refresh-token.js';
import type { MaxFailedAttemptsProvider } from '../domain/ports/max-failed-attempts-provider.js';
import { LoginPolicy } from '../domain/value-objects/login-policy.js';
import type {
  AccessTokenSigner,
  PasswordHasher,
  RefreshTokenGenerator,
  RefreshTokenRepository,
  UserRepository,
} from '../domain/ports/index.js';
import type { LoginCommand, LoginOutcome, LoginResult } from './login.types.js';
import { toAuthUser } from './auth-user.js';

export interface LoginUseCaseDependencies {
  userRepository: UserRepository;
  refreshTokenRepository: RefreshTokenRepository;
  passwordHasher: PasswordHasher;
  accessTokenSigner: AccessTokenSigner;
  refreshTokenGenerator: RefreshTokenGenerator;
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
  loginPolicy: LoginPolicy;
  /** Límite de intentos vigente (parámetro LOGIN_INTENTOS); si falta se usa `loginPolicy`. */
  maxFailedAttemptsProvider?: MaxFailedAttemptsProvider;
  clock?: () => Date;
}

export class LoginUseCase {
  private readonly userRepository: UserRepository;
  private readonly refreshTokenRepository: RefreshTokenRepository;
  private readonly passwordHasher: PasswordHasher;
  private readonly accessTokenSigner: AccessTokenSigner;
  private readonly refreshTokenGenerator: RefreshTokenGenerator;
  private readonly unitOfWork: UnitOfWork;
  private readonly auditLogger: AuditLogger;
  private readonly loginPolicy: LoginPolicy;
  private readonly maxFailedAttemptsProvider?: MaxFailedAttemptsProvider;
  private readonly clock: () => Date;

  constructor(deps: LoginUseCaseDependencies) {
    this.userRepository = deps.userRepository;
    this.refreshTokenRepository = deps.refreshTokenRepository;
    this.passwordHasher = deps.passwordHasher;
    this.accessTokenSigner = deps.accessTokenSigner;
    this.refreshTokenGenerator = deps.refreshTokenGenerator;
    this.unitOfWork = deps.unitOfWork;
    this.auditLogger = deps.auditLogger;
    this.loginPolicy = deps.loginPolicy;
    this.maxFailedAttemptsProvider = deps.maxFailedAttemptsProvider;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: LoginCommand): Promise<LoginResult> {
    const normalizedEmail = command.email.trim().toLowerCase();
    const now = this.clock();
    const policy = await this.resolvePolicy();

    // FASE 1: Verificación de contraseña fuera de la transacción para no retener bloqueos durante argon2
    const initialUser = await this.userRepository.findByEmail(normalizedEmail);
    let passwordValid = false;

    if (!initialUser) {
      await this.passwordHasher.verifyDummy(command.password);
    } else if (initialUser.status === 'ACTIVE' && !initialUser.isLocked(now)) {
      if (initialUser.passwordHash) {
        passwordValid = await this.passwordHasher.verify(
          command.password,
          initialUser.passwordHash,
        );
      } else {
        await this.passwordHasher.verifyDummy(command.password);
      }
    }

    // FASE 2: Transacción con bloqueo de fila y auditoría
    const outcome = await this.unitOfWork.run(async (): Promise<LoginOutcome> => {
      if (!initialUser) {
        await this.auditLogger.log({
          action: 'LOGIN_FAILURE',
          entity: 'User',
          entityId: normalizedEmail,
          actor: normalizedEmail,
          ip: command.ip,
          after: {
            outcome: 'FAILURE',
            reason: 'INVALID_CREDENTIALS',
            policy: {
              maxFailedAttempts: policy.maxFailedAttempts,
              lockoutMinutes: policy.lockoutMinutes,
            },
          },
        });
        return { outcome: 'INVALID_CREDENTIALS' };
      }

      // Releer bajo bloqueo de fila (SELECT ... FOR UPDATE)
      const user = await this.userRepository.findByEmailForUpdate(normalizedEmail);
      if (!user) {
        return { outcome: 'INVALID_CREDENTIALS' };
      }

      const beforeAudit = {
        status: user.status,
        failedLoginAttempts: user.failedLoginAttempts,
        lockedUntil: user.lockedUntil?.toISOString() ?? null,
      };

      // Re-verificar estados en caliente
      if (user.status === 'PENDING_ACTIVATION') {
        await this.auditLogger.log({
          action: 'LOGIN_FAILURE',
          entity: 'User',
          entityId: user.id,
          actor: user.id,
          ip: command.ip,
          before: beforeAudit,
          after: {
            outcome: 'FAILURE',
            reason: 'ACCOUNT_PENDING_ACTIVATION',
            failedLoginAttempts: user.failedLoginAttempts,
            lockedUntil: user.lockedUntil?.toISOString() ?? null,
            policy: {
              maxFailedAttempts: policy.maxFailedAttempts,
              lockoutMinutes: policy.lockoutMinutes,
            },
          },
        });
        return { outcome: 'ACCOUNT_PENDING_ACTIVATION' };
      }

      if (user.status === 'INACTIVE') {
        await this.auditLogger.log({
          action: 'LOGIN_FAILURE',
          entity: 'User',
          entityId: user.id,
          actor: user.id,
          ip: command.ip,
          before: beforeAudit,
          after: {
            outcome: 'FAILURE',
            reason: 'ACCOUNT_INACTIVE',
            failedLoginAttempts: user.failedLoginAttempts,
            lockedUntil: user.lockedUntil?.toISOString() ?? null,
            policy: {
              maxFailedAttempts: policy.maxFailedAttempts,
              lockoutMinutes: policy.lockoutMinutes,
            },
          },
        });
        return { outcome: 'ACCOUNT_INACTIVE' };
      }

      if (user.isLocked(now)) {
        const retryAfterSeconds = user.lockRemainingSeconds(now);
        await this.auditLogger.log({
          action: 'LOGIN_FAILURE',
          entity: 'User',
          entityId: user.id,
          actor: user.id,
          ip: command.ip,
          before: beforeAudit,
          after: {
            outcome: 'FAILURE',
            reason: 'ACCOUNT_LOCKED',
            failedLoginAttempts: user.failedLoginAttempts,
            lockedUntil: user.lockedUntil?.toISOString() ?? null,
            policy: {
              maxFailedAttempts: policy.maxFailedAttempts,
              lockoutMinutes: policy.lockoutMinutes,
            },
          },
        });
        return { outcome: 'ACCOUNT_LOCKED', retryAfterSeconds };
      }

      if (!passwordValid) {
        user.registerFailedLogin(now, policy);
        await this.userRepository.save(user);

        const isNowLocked = user.isLocked(now);
        await this.auditLogger.log({
          action: 'LOGIN_FAILURE',
          entity: 'User',
          entityId: user.id,
          actor: user.id,
          ip: command.ip,
          before: beforeAudit,
          after: {
            outcome: 'FAILURE',
            reason: 'INVALID_CREDENTIALS',
            ...(isNowLocked ? { status: 'LOCKED_NOW' } : {}),
            failedLoginAttempts: user.failedLoginAttempts,
            lockedUntil: user.lockedUntil?.toISOString() ?? null,
            policy: {
              maxFailedAttempts: policy.maxFailedAttempts,
              lockoutMinutes: policy.lockoutMinutes,
            },
          },
        });
        return { outcome: 'INVALID_CREDENTIALS' };
      }

      // Credenciales correctas y cuenta activa
      user.registerSuccessfulLogin(now);
      await this.userRepository.save(user);

      const { token: accessToken, expiresAt: accessExpiresAt } = await this.accessTokenSigner.sign(
        { userId: user.id },
        now,
      );

      const {
        token: refreshToken,
        tokenHash,
        expiresAt: refreshExpiresAt,
      } = this.refreshTokenGenerator.generate(now);

      const refreshTokenEntity = RefreshToken.create({
        userId: user.id,
        tokenHash,
        expiresAt: refreshExpiresAt,
        createdByIp: command.ip,
      });
      await this.refreshTokenRepository.add(refreshTokenEntity);

      await this.auditLogger.log({
        action: 'LOGIN_SUCCESS',
        entity: 'User',
        entityId: user.id,
        actor: user.id,
        ip: command.ip,
        before: beforeAudit,
        after: {
          outcome: 'SUCCESS',
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      const result: LoginResult = {
        accessToken,
        accessTokenExpiresAt: accessExpiresAt.toISOString(),
        refreshToken,
        refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
        user: toAuthUser(user),
      };

      return { outcome: 'SUCCESS', result };
    });

    // FASE 3: Lanzar los errores correspondientes fuera de la transacción para no hacer rollback de los intentos ni la auditoría
    switch (outcome.outcome) {
      case 'SUCCESS':
        return outcome.result;
      case 'INVALID_CREDENTIALS':
        throw new UnauthorizedError('Correo o contraseña incorrectos');
      case 'ACCOUNT_LOCKED':
        throw new AccountLockedError(outcome.retryAfterSeconds);
      case 'ACCOUNT_INACTIVE':
        throw new AccountInactiveError();
      case 'ACCOUNT_PENDING_ACTIVATION':
        throw new AccountPendingActivationError();
    }
  }

  /** Política vigente: el límite de intentos sale del parámetro; el bloqueo, de la configuración. */
  private async resolvePolicy(): Promise<LoginPolicy> {
    if (!this.maxFailedAttemptsProvider) {
      return this.loginPolicy;
    }
    const maxFailedAttempts = await this.maxFailedAttemptsProvider.getMaxFailedAttempts();
    return new LoginPolicy({
      maxFailedAttempts,
      lockoutMinutes: this.loginPolicy.lockoutMinutes,
    });
  }
}
