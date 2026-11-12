import {
  defineParametersRequestSchema,
  parametersResponseSchema,
  type DefineParametersRequest,
  type ParametersResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function defineParameters(body: DefineParametersRequest): Promise<ParametersResponse> {
  const validatedBody = defineParametersRequestSchema.parse(body);
  const response = await apiClient.post<unknown>('/parameters', validatedBody);
  return parametersResponseSchema.parse(response.data);
}
