export interface GeneratedActivationToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface ActivationTokenGenerator {
  readonly lifetimeHours: number;
  hash(token: string): string;
  generate(now: Date): GeneratedActivationToken;
}
