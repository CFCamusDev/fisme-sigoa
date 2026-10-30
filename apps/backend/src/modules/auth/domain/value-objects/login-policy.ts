export interface LoginPolicyProps {
  maxFailedAttempts?: number;
  lockoutMinutes?: number;
}

export class LoginPolicy {
  public readonly maxFailedAttempts: number;
  public readonly lockoutMinutes: number;

  constructor(props?: LoginPolicyProps) {
    this.maxFailedAttempts = props?.maxFailedAttempts ?? 5;
    this.lockoutMinutes = props?.lockoutMinutes ?? 15;
  }
}
