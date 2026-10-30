export interface SignAccessTokenParams {
  userId: string;
}

export interface AccessTokenPayload {
  token: string;
  expiresAt: Date;
}

export interface AccessTokenSigner {
  sign(params: SignAccessTokenParams, now: Date): Promise<AccessTokenPayload>;
}
