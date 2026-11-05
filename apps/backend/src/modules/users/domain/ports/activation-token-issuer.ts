export interface IssuedActivationToken {
  token: string;
  expiresAt: Date;
}

export interface ActivationTokenIssuer {
  issue(userId: string, now: Date): Promise<IssuedActivationToken>;
}
