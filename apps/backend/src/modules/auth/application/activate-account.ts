import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { PasswordPolicy } from '../domain/value-objects/password-policy.js';
import { InvalidActivationTokenError } from '../domain/errors/index.js';
import type {
  ActivationTokenGenerator,
  ActivationTokenRepository,
  PasswordHasher,
  UserRepository,
} from '../domain/ports/index.js';
import type { ActivateAccountCommand, ActivateAccountResult } from './activate-account.types.js';

export interface ActivateAccountUseCaseDependencies {
  userRepository: UserRepository;
  activationTokenRepository: ActivationTokenRepository;
  activationTokenGenerator: ActivationTokenGenerator;
  passwordHasher: PasswordHasher;
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
  clock?: () => Date;
}

export class ActivateAccountUseCase {
  private readonly userRepository: UserRepository;
  private readonly activationTokenRepository: ActivationTokenRepository;
  private readonly activationTokenGenerator: ActivationTokenGenerator;
  private readonly passwordHasher: PasswordHasher;
  private readonly unitOfWork: UnitOfWork;
  private readonly auditLogger: AuditLogger;
  private readonly clock: () => Date;

  constructor(deps: ActivateAccountUseCaseDependencies) {
    this.userRepository = deps.userRepository;
    this.activationTokenRepository = deps.activationTokenRepository;
    this.activationTokenGenerator = deps.activationTokenGenerator;
    this.passwordHasher = deps.passwordHasher;
    this.unitOfWork = deps.unitOfWork;
    this.auditLogger = deps.auditLogger;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: ActivateAccountCommand): Promise<ActivateAccountResult> {
    const now = this.clock();

    // D6: 1. Validación de política de contraseña primero (CA3; no revela nada del token)
    PasswordPolicy.assert(command.password);

    // D4: 2. Hash del token y comprobación previa fuera de la transacción para descartar rápido
    const tokenHash = this.activationTokenGenerator.hash(command.token);
    const preCheckToken = await this.activationTokenRepository.findByTokenHash(tokenHash);
    if (!preCheckToken || !preCheckToken.isUsable(now)) {
      throw new InvalidActivationTokenError();
    }

    // D4: 3. Hashing de contraseña con argon2 fuera de la transacción (no retiene bloqueos)
    const passwordHash = await this.passwordHasher.hash(command.password);

    // 4. Transacción de consumo, activación y auditoría
    await this.unitOfWork.run(async () => {
      // Bloqueo y verificación definitiva del token
      const token = await this.activationTokenRepository.findByTokenHashForUpdate(tokenHash);
      if (!token) {
        throw new InvalidActivationTokenError();
      }

      // Si otro proceso consumió o revocó el token mientras tanto, consume() lanza InvalidActivationTokenError
      token.consume(now);

      // Bloqueo y verificación del usuario (orden fijo de bloqueos: token -> usuario)
      const user = await this.userRepository.findByIdForUpdate(token.userId);
      // D5: si el usuario no existe o ya no está PENDING_ACTIVATION, unificar error (no revelar estado)
      if (!user || user.status !== 'PENDING_ACTIVATION') {
        throw new InvalidActivationTokenError();
      }

      // Transición en la entidad de dominio
      user.activate(passwordHash, now);

      // Persistencia condicional (defensa en profundidad)
      await this.userRepository.saveActivation(user);
      await this.activationTokenRepository.save(token);

      // Invalida cualquier otro token pendiente del mismo usuario
      await this.activationTokenRepository.revokePendingByUserId(user.id, now);

      // D7: Auditoría en la misma transacción (User y ActivationToken)
      await this.auditLogger.log({
        action: 'STATE_CHANGE',
        entity: 'User',
        entityId: user.id,
        actor: user.id,
        ip: command.ip ?? undefined,
        before: {
          status: 'PENDING_ACTIVATION',
        },
        after: {
          status: 'ACTIVE',
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

    return {
      status: 'ACTIVE',
    };
  }
}
