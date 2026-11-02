export interface GeneratedRefreshToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface RefreshTokenGenerator {
  generate(now: Date): GeneratedRefreshToken;
  hash(token: string): string;
}
