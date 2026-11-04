import { randomUUID } from 'node:crypto';
import { InvalidActivationTokenError } from '../errors/invalid-activation-token-error.js';

export const DEFAULT_ACTIVATION_TOKEN_LIFETIME_HOURS = 48;

export interface ActivationTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt?: Date;
  createdBy?: string | null;
}

export interface CreateActivationTokenProps {
  id?: string;
  userId: string;
  tokenHash: string;
  lifetimeHours?: number;
  now?: Date;
  createdBy?: string | null;
}

export class ActivationToken {
  private constructor(private readonly props: ActivationTokenProps) {
    this.props.usedAt = props.usedAt ?? null;
    this.props.revokedAt = props.revokedAt ?? null;
    this.props.createdBy = props.createdBy ?? null;
  }

  public static create(props: CreateActivationTokenProps): ActivationToken {
    const now = props.now ?? new Date();
    const hours = props.lifetimeHours ?? DEFAULT_ACTIVATION_TOKEN_LIFETIME_HOURS;
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return new ActivationToken({
      id: props.id ?? randomUUID(),
      userId: props.userId,
      tokenHash: props.tokenHash,
      expiresAt,
      usedAt: null,
      revokedAt: null,
      createdAt: now,
      createdBy: props.createdBy ?? null,
    });
  }

  public static restore(props: ActivationTokenProps): ActivationToken {
    return new ActivationToken({
      ...props,
      expiresAt: new Date(props.expiresAt.getTime()),
      usedAt: props.usedAt ? new Date(props.usedAt.getTime()) : null,
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

  get usedAt(): Date | null {
    return this.props.usedAt ? new Date(this.props.usedAt.getTime()) : null;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt ? new Date(this.props.revokedAt.getTime()) : null;
  }

  get createdAt(): Date | undefined {
    return this.props.createdAt ? new Date(this.props.createdAt.getTime()) : undefined;
  }

  get createdBy(): string | null {
    return this.props.createdBy ?? null;
  }

  public isUsable(now: Date = new Date()): boolean {
    if (this.props.usedAt !== null) {
      return false;
    }
    if (this.props.revokedAt !== null) {
      return false;
    }
    return this.props.expiresAt.getTime() > now.getTime();
  }

  public consume(now: Date = new Date()): void {
    if (!this.isUsable(now)) {
      throw new InvalidActivationTokenError();
    }
    this.props.usedAt = new Date(now.getTime());
  }

  public revoke(now: Date = new Date()): void {
    if (this.props.revokedAt !== null) {
      return;
    }
    this.props.revokedAt = new Date(now.getTime());
  }
}
