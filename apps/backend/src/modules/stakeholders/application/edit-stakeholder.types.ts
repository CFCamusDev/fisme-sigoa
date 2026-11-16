import type { EditStakeholderRequest } from '@sigoa/shared';

export type EditStakeholderCommand = EditStakeholderRequest & {
  readonly id: string;
  readonly actorId: string;
  readonly ip?: string | null;
};
