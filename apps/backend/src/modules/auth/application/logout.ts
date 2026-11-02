import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { ForbiddenError } from '../../../shared/errors/app-error.js';
import type { RefreshTokenGenerator, RefreshTokenRepository } from '../domain/ports/index.js';
import { buildRefreshTokenRevocationEvent } from './refresh-token-audit.js';
import type { LogoutCommand } from './logout.types.js';

export interface LogoutUseCaseDependencies {
  refreshTokenRepository: RefreshTokenRepository;
  refreshTokenGenerator: RefreshTokenGenerator;
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
  clock?: () => Date;
}

export class LogoutUseCase {
  private readonly refreshTokenRepository: RefreshTokenRepository;
  private readonly refreshTokenGenerator: RefreshTokenGenerator;
  private readonly unitOfWork: UnitOfWork;
  private readonly auditLogger: AuditLogger;
  private readonly clock: () => Date;

  constructor(deps: LogoutUseCaseDependencies) {
    this.refreshTokenRepository = deps.refreshTokenRepository;
    this.refreshTokenGenerator = deps.refreshTokenGenerator;
    this.unitOfWork = deps.unitOfWork;
    this.auditLogger = deps.auditLogger;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: LogoutCommand): Promise<void> {
    const now = this.clock();
    const tokenHash = this.refreshTokenGenerator.hash(command.refreshToken);

    await this.unitOfWork.run(async () => {
      const token = await this.refreshTokenRepository.findByTokenHashForUpdate(tokenHash);
      if (!token || !token.isUsable(now)) {
        return;
      }

      if (token.userId !== command.userId) {
        throw new ForbiddenError('No tiene permisos para cerrar la sesión de otro usuario.');
      }

      token.revoke(now);
      await this.refreshTokenRepository.save(token);

      await this.auditLogger.log(
        buildRefreshTokenRevocationEvent({
          tokenId: token.id,
          userId: command.userId,
          revokedAt: now,
          reason: 'LOGOUT',
          ip: command.ip,
        }),
      );
    });
  }
}
