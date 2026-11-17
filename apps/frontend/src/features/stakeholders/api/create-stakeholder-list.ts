import {
  stakeholderListDtoSchema,
  type CreateStakeholderListRequest,
  type StakeholderListDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Crea una lista del Anexo 3 para un tipo y año. */
export async function createStakeholderList(
  input: CreateStakeholderListRequest,
): Promise<StakeholderListDto> {
  const response = await apiClient.post<unknown>('/stakeholder-lists', input);
  return stakeholderListDtoSchema.parse(response.data);
}
