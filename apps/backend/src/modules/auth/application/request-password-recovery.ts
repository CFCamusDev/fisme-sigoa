import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { PasswordRecoveryPolicy } from '../domain/value-objects/password-recovery-policy.js';
import type {
  ActivationTokenRepository,
  PasswordResetEmailSender,
  UserRepository,
} from '../domain/ports/index.js';
import type { ActivationTokenIssuerService } from './activation-token-issuer-service.js';
import {
  DefaultDetachedTaskRunner,
  type DetachedTaskRunner,
  type DetachedTaskRunnerLogger,
} from './detached-task-runner.js';
import type {
  RequestPasswordRecoveryCommand,
  RequestPasswordRecoveryResult,
} from './request-password-recovery.types.js';

export interface RequestPasswordRecoveryUseCaseDependencies {
  userRepository: UserRepository;
  activationTokenRepository: ActivationTokenRepository;
  activationTokenIssuer: ActivationTokenIssuerService;
  passwordResetEmailSender: PasswordResetEmailSender;
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
  detachedTaskRunner?: DetachedTaskRunner;
  clock?: () => Date;
  logger?: DetachedTaskRunnerLogger;
}

export class RequestPasswordRecoveryUseCase {
  private readonly userRepository: UserRepository;
  private readonly activationTokenRepository: ActivationTokenRepository;
  private readonly activationTokenIssuer: ActivationTokenIssuerService;
  private readonly passwordResetEmailSender: PasswordResetEmailSender;
  private readonly unitOfWork: UnitOfWork;
  private readonly auditLogger: AuditLogger;
  private readonly detachedTaskRunner: DetachedTaskRunner;
  private readonly clock: () => Date;

  constructor(deps: RequestPasswordRecoveryUseCaseDependencies) {
    this.userRepository = deps.userRepository;
    this.activationTokenRepository = deps.activationTokenRepository;
    this.activationTokenIssuer = deps.activationTokenIssuer;
    this.passwordResetEmailSender = deps.passwordResetEmailSender;
    this.unitOfWork = deps.unitOfWork;
    this.auditLogger = deps.auditLogger;
    this.detachedTaskRunner = deps.detachedTaskRunner ?? new DefaultDetachedTaskRunner(deps.logger);
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: RequestPasswordRecoveryCommand): Promise<RequestPasswordRecoveryResult> {
    const now = this.clock();
    let emailDispatchData: {
      to: string;
      names: string;
      rawToken: string;
      expiresAt: Date;
    } | null = null;

    await this.unitOfWork.run(async () => {
      // Bloqueo y obtención de la fila del usuario para serializar solicitudes simultáneas
      const user = await this.userRepository.findByEmailForUpdate(command.email);
      const latestTokenCreatedAt = user
        ? await this.activationTokenRepository.findLatestCreatedAtByUserId(user.id)
        : null;

      const evaluation = PasswordRecoveryPolicy.evaluate({
        user,
        latestTokenCreatedAt,
        now,
      });

      if (evaluation.action === 'SKIP') {
        return;
      }

      // Si action === 'ISSUE', el usuario existe y su estado es ACTIVE garantizado por la política
      const activeUser = user!;

      const issued = await this.activationTokenIssuer.issue(activeUser.id, now, activeUser.id);

      await this.auditLogger.log({
        action: 'UPDATE',
        entity: 'User',
        entityId: activeUser.id,
        actor: activeUser.id,
        ip: command.ip ?? undefined,
        after: {
          passwordRecoveryRequested: true,
          expiresAt: issued.expiresAt.toISOString(),
        },
      });

      emailDispatchData = {
        to: activeUser.email,
        names: activeUser.names,
        rawToken: issued.token,
        expiresAt: issued.expiresAt,
      };
    });

    if (emailDispatchData) {
      const data = emailDispatchData;
      this.detachedTaskRunner.run(async () => {
        await this.passwordResetEmailSender.send(data);
      });
    }

    return PasswordRecoveryPolicy.publicResult();
  }
}
