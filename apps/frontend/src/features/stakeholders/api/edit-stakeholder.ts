import {
  stakeholderDtoSchema,
  type EditStakeholderRequest,
  type StakeholderDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface EditStakeholderVariables {
  readonly id: string;
  readonly changes: EditStakeholderRequest;
}

/** Edita parcialmente un constituyente activo. */
export async function editStakeholder({
  id,
  changes,
}: EditStakeholderVariables): Promise<StakeholderDto> {
  const response = await apiClient.patch<unknown>(`/stakeholders/${id}`, changes);
  return stakeholderDtoSchema.parse(response.data);
}
