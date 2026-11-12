import {
  loginRequestSchema,
  loginResponseSchema,
  type LoginRequest,
  type LoginResponse,
} from '@sigoa/shared';
import { apiClient } from '@/lib/axios';

export async function login(request: LoginRequest): Promise<LoginResponse> {
  const validatedRequest = loginRequestSchema.parse(request);
  const response = await apiClient.post<unknown>('/auth/login', validatedRequest);
  return loginResponseSchema.parse(response.data);
}
