import { ActivationToken } from '../domain/entities/activation-token.js';
import type { ActivationTokenGenerator } from '../domain/ports/activation-token-generator.js';
import type { ActivationTokenRepository } from '../domain/ports/activation-token-repository.js';

export interface IssuedActivationToken {
  token: string;
  expiresAt: Date;
}

export class ActivationTokenIssuerService {
  constructor(
    private readonly tokenRepository: ActivationTokenRepository,
    private readonly tokenGenerator: ActivationTokenGenerator,
  ) {}

  public async issue(
    userId: string,
    now: Date = new Date(),
    createdBy?: string | null,
  ): Promise<IssuedActivationToken> {
    // 1. Invalida los tokens previos que estén pendientes para este usuario
    await this.tokenRepository.revokePendingByUserId(userId, now);

    // 2. Genera un nuevo token criptográficamente seguro
    const generated = this.tokenGenerator.generate(now);

    // 3. Crea la entidad de dominio con su hash
    const activationToken = ActivationToken.create({
      userId,
      tokenHash: generated.tokenHash,
      lifetimeHours: this.tokenGenerator.lifetimeHours,
      now,
      createdBy,
    });

    // 4. Persiste en el repositorio
    await this.tokenRepository.add(activationToken);

    // 5. Retorna únicamente el token en texto plano y la fecha de expiración
    return {
      token: generated.token,
      expiresAt: activationToken.expiresAt,
    };
  }
}
