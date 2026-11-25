import type {
  ApiResponse,
  SigninInput,
  SignupInput,
  UserDTO,
} from '@documind/shared';
import { apiClient } from '../../../core/api/client';

export async function signIn(payload: SigninInput): Promise<UserDTO> {
  const response = await apiClient.post<ApiResponse<{ user: UserDTO }>>(
    '/auth/signin',
    payload
  );
  return response.data.data.user;
}

export async function signUp(payload: SignupInput): Promise<UserDTO> {
  const response = await apiClient.post<ApiResponse<{ user: UserDTO }>>(
    '/auth/signup',
    payload
  );
  return response.data.data.user;
}

export async function signOut(): Promise<void> {
  await apiClient.post('/auth/signout');
}

export async function getCurrentUser(): Promise<UserDTO> {
  const response = await apiClient.get<ApiResponse<{ user: UserDTO }>>('/auth/me');
  return response.data.data.user;
}
