import type { RegisterStakeholderRequest } from '@sigoa/shared';

export type RegisterStakeholderCommand = RegisterStakeholderRequest & {
  readonly actorId: string;
  readonly ip?: string | null;
};
