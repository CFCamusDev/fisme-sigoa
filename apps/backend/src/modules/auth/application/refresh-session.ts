import type { AuditLogger } from '../../../shared/audit/audit-logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work/unit-of-work.js';
import { InvalidRefreshTokenError } from '../domain/errors/index.js';
import type {
  AccessTokenSigner,
  RefreshTokenGenerator,
  RefreshTokenRepository,
  UserRepository,
} from '../domain/ports/index.js';
import { toAuthUser } from './auth-user.js';
import { buildRefreshTokenRevocationEvent } from './refresh-token-audit.js';
import type { RefreshSessionCommand, RefreshSessionResult } from './refresh-session.types.js';

export interface RefreshSessionUseCaseDependencies {
  userRepository: UserRepository;
  refreshTokenRepository: RefreshTokenRepository;
  accessTokenSigner: AccessTokenSigner;
  refreshTokenGenerator: RefreshTokenGenerator;
  unitOfWork: UnitOfWork;
  auditLogger: AuditLogger;
  clock?: () => Date;
}

export class RefreshSessionUseCase {
  private readonly userRepository: UserRepository;
  private readonly refreshTokenRepository: RefreshTokenRepository;
  private readonly accessTokenSigner: AccessTokenSigner;
  private readonly refreshTokenGenerator: RefreshTokenGenerator;
  private readonly unitOfWork: UnitOfWork;
  private readonly auditLogger: AuditLogger;
  private readonly clock: () => Date;

  constructor(deps: RefreshSessionUseCaseDependencies) {
    this.userRepository = deps.userRepository;
    this.refreshTokenRepository = deps.refreshTokenRepository;
    this.accessTokenSigner = deps.accessTokenSigner;
    this.refreshTokenGenerator = deps.refreshTokenGenerator;
    this.unitOfWork = deps.unitOfWork;
    this.auditLogger = deps.auditLogger;
    this.clock = deps.clock ?? (() => new Date());
  }

  async execute(command: RefreshSessionCommand): Promise<RefreshSessionResult> {
    const now = this.clock();
    const tokenHash = this.refreshTokenGenerator.hash(command.refreshToken);

    return this.unitOfWork.run(async () => {
      const existingToken = await this.refreshTokenRepository.findByTokenHashForUpdate(tokenHash);
      if (!existingToken) {
        throw new InvalidRefreshTokenError();
      }

      existingToken.assertUsable(now);

      const user = await this.userRepository.findById(existingToken.userId);
      if (!user || user.status !== 'ACTIVE') {
        throw new InvalidRefreshTokenError();
      }

      const nextGenerated = this.refreshTokenGenerator.generate(now);
      const nextTokenEntity = existingToken.rotate(now, {
        tokenHash: nextGenerated.tokenHash,
        expiresAt: nextGenerated.expiresAt,
        createdByIp: command.ip,
      });

      await this.refreshTokenRepository.save(existingToken);
      await this.refreshTokenRepository.add(nextTokenEntity);

      const { token: accessToken, expiresAt: accessExpiresAt } = await this.accessTokenSigner.sign(
        { userId: user.id },
        now,
      );

      await this.auditLogger.log(
        buildRefreshTokenRevocationEvent({
          tokenId: existingToken.id,
          userId: user.id,
          revokedAt: now,
          reason: 'ROTATED',
          ip: command.ip,
          replacedBy: nextTokenEntity.id,
        }),
      );

      return {
        accessToken,
        accessTokenExpiresAt: accessExpiresAt.toISOString(),
        refreshToken: nextGenerated.token,
        refreshTokenExpiresAt: nextGenerated.expiresAt.toISOString(),
        user: toAuthUser(user),
      };
    });
  }
}
