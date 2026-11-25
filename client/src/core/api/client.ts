import axios, { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@documind/shared';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Extracts a user-facing error message from Axios or generic thrown errors.
 */
export function extractApiErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as Partial<ApiErrorResponse> | undefined;
    if (data?.error?.message) {
      return data.error.message;
    }
    if (error.message) {
      return error.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
