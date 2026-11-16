import {
  stakeholderDtoSchema,
  type StakeholderDto,
  type VoidStakeholderRequest,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export interface VoidStakeholderVariables {
  readonly id: string;
  readonly payload: VoidStakeholderRequest;
}

/** Anula lógicamente un constituyente activo con un motivo obligatorio. */
export async function voidStakeholder({
  id,
  payload,
}: VoidStakeholderVariables): Promise<StakeholderDto> {
  const response = await apiClient.post<unknown>(`/stakeholders/${id}/void`, payload);
  return stakeholderDtoSchema.parse(response.data);
}
