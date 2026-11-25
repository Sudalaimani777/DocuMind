import { useMutation } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { SigninInput } from '@documind/shared';
import { extractApiErrorMessage } from '../../../core/api/client';
import { useAuthStore } from '../../../core/store/authStore';
import { signIn } from '../api/auth.api';

interface RedirectState {
  from?: { pathname?: string };
}

/**
 * Handles user sign-in mutation, Zustand session update, toast notification, and redirect.
 */
export function useSignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const setUser = useAuthStore((s) => s.setUser);

  const mutation = useMutation({
    mutationFn: (input: SigninInput) => signIn(input),
    onSuccess: (user) => {
      setUser(user);
      toast.success('Signed in successfully.');
      const redirectTo =
        (location.state as RedirectState | null)?.from?.pathname || '/library';
      navigate(redirectTo, { replace: true });
    },
  });

  return {
    submitSignIn: mutation.mutateAsync,
    isPending: mutation.isPending,
    errorMessage: mutation.isError
      ? extractApiErrorMessage(mutation.error, 'Invalid email or password.')
      : null,
    resetError: mutation.reset,
  };
}
