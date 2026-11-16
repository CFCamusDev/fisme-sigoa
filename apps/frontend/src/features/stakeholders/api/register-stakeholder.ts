import {
  stakeholderDtoSchema,
  type RegisterStakeholderRequest,
  type StakeholderDto,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

/** Registra una persona o institución en el registro maestro de constituyentes. */
export async function registerStakeholder(
  input: RegisterStakeholderRequest,
): Promise<StakeholderDto> {
  const response = await apiClient.post<unknown>('/stakeholders', input);
  return stakeholderDtoSchema.parse(response.data);
}
