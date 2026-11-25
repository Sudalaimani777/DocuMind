import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { SignupInput } from '@documind/shared';
import { extractApiErrorMessage } from '../../../core/api/client';
import { useAuthStore } from '../../../core/store/authStore';
import { signUp } from '../api/auth.api';

/**
 * Handles user registration mutation, Zustand session update, toast feedback, and redirect.
 */
export function useSignUp() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  const mutation = useMutation({
    mutationFn: (input: SignupInput) => signUp(input),
    onSuccess: (user) => {
      setUser(user);
      toast.success('Account created successfully.');
      navigate('/library', { replace: true });
    },
  });

  return {
    submitSignUp: mutation.mutateAsync,
    isPending: mutation.isPending,
    errorMessage: mutation.isError
      ? extractApiErrorMessage(mutation.error, 'Could not create account. Please try again.')
      : null,
    resetError: mutation.reset,
  };
}
