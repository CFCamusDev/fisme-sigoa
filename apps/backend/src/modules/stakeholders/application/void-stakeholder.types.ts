import type { VoidStakeholderRequest } from '@sigoa/shared';

export type VoidStakeholderCommand = VoidStakeholderRequest & {
  readonly id: string;
  readonly actorId: string;
  readonly ip?: string | null;
};
