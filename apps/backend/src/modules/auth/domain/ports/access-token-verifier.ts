export interface VerifiedAccessToken {
  userId: string;
}

export interface AccessTokenVerifier {
  verify(token: string, now: Date): Promise<VerifiedAccessToken>;
}
