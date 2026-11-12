import { randomUUID } from 'node:crypto';
import { InvalidRefreshTokenError } from '../errors/invalid-refresh-token-error.js';

export interface RefreshTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt?: Date;
  createdByIp?: string | null;
}

export interface CreateRefreshTokenProps {
  id?: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdByIp?: string | null;
}

export interface RotateRefreshTokenProps {
  tokenHash: string;
  expiresAt: Date;
  createdByIp?: string | null;
}

export class RefreshToken {
  private constructor(private readonly props: RefreshTokenProps) {
    this.props.revokedAt = props.revokedAt ?? null;
    this.props.createdByIp = props.createdByIp ?? null;
  }

  public static create(props: CreateRefreshTokenProps): RefreshToken {
    return new RefreshToken({
      id: props.id ?? randomUUID(),
      userId: props.userId,
      tokenHash: props.tokenHash,
      expiresAt: new Date(props.expiresAt.getTime()),
      revokedAt: null,
      createdAt: new Date(),
      createdByIp: props.createdByIp ?? null,
    });
  }

  public static restore(props: RefreshTokenProps): RefreshToken {
    return new RefreshToken({
      ...props,
      expiresAt: new Date(props.expiresAt.getTime()),
      revokedAt: props.revokedAt ? new Date(props.revokedAt.getTime()) : null,
      createdAt: props.createdAt ? new Date(props.createdAt.getTime()) : undefined,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get expiresAt(): Date {
    return new Date(this.props.expiresAt.getTime());
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt ? new Date(this.props.revokedAt.getTime()) : null;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt ? new Date(this.props.createdAt.getTime()) : undefined;
  }

  get createdByIp(): string | null {
    return this.props.createdByIp ?? null;
  }

  public isRevoked(): boolean {
    return this.props.revokedAt !== null && this.props.revokedAt !== undefined;
  }

  public isExpired(now: Date): boolean {
    return this.props.expiresAt.getTime() <= now.getTime();
  }

  public isUsable(now: Date): boolean {
    return !this.isRevoked() && !this.isExpired(now);
  }

  public revoke(now: Date): void {
    if (!this.isRevoked()) {
      this.props.revokedAt = new Date(now.getTime());
    }
  }

  public assertUsable(now: Date): void {
    if (!this.isUsable(now)) {
      throw new InvalidRefreshTokenError();
    }
  }

  public rotate(now: Date, next: RotateRefreshTokenProps): RefreshToken {
    this.assertUsable(now);
    this.revoke(now);
    return RefreshToken.create({
      userId: this.props.userId,
      tokenHash: next.tokenHash,
      expiresAt: next.expiresAt,
      createdByIp: next.createdByIp,
    });
  }
}
