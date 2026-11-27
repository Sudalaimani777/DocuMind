import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from '../../../components/ui/toast';
import { signinSchema, type SigninInput } from '@documind/shared';
import { cn } from '../../../core/lib/utils';
import { useSignIn } from '../hooks/useSignIn';

/**
 * Validated Sign-In form wired to POST /api/v1/auth/signin via React Hook Form + Zod.
 */
export function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const { submitSignIn, isPending, errorMessage, resetError } = useSignIn();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SigninInput>({
    resolver: zodResolver(signinSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SigninInput) => {
    resetError();
    try {
      await submitSignIn(data);
    } catch {
      // Error message is surfaced via errorMessage state from useSignIn
    }
  };

  const handleResetPasswordNotice = () => {
    toast.info('Password resets are managed by your workspace administrator.');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-15">
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-md border border-status-failed-border bg-status-failed-bg px-20 py-3 font-t05 text-t05 text-status-failed-text"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="signin-email"
          className="font-t05 text-t05 text-on-surface-variant"
        >
          Email Address
        </label>
        <div
          className={cn(
            'rounded-card border bg-surface-subtle/60 transition-colors focus-within:border-outline-focus focus-within:bg-surface',
            errors.email ? 'border-secondary' : 'border-outline'
          )}
        >
          <input
            id="signin-email"
            type="email"
            autoComplete="email"
            placeholder="Enter your work email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'signin-email-error' : undefined}
            className="w-full bg-transparent border-0 px-20 py-3.5 rounded-card text-on-surface placeholder:text-on-surface-variant font-t04 text-t04 focus:outline-none focus:ring-0"
            {...register('email')}
          />
        </div>
        {errors.email ? (
          <p
            id="signin-email-error"
            role="alert"
            className="font-t05 text-t05 text-secondary"
          >
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="signin-password"
          className="font-t05 text-t05 text-on-surface-variant"
        >
          Password
        </label>
        <div
          className={cn(
            'rounded-card border bg-surface-subtle/60 transition-colors focus-within:border-outline-focus focus-within:bg-surface relative',
            errors.password ? 'border-secondary' : 'border-outline'
          )}
        >
          <input
            id="signin-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'signin-password-error' : undefined}
            className="w-full bg-transparent border-0 pl-20 pr-12 py-3.5 rounded-card text-on-surface placeholder:text-on-surface-variant font-t04 text-t04 focus:outline-none focus:ring-0"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-3 flex items-center text-on-surface-variant hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus rounded-md px-1"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {errors.password ? (
          <p
            id="signin-password-error"
            role="alert"
            className="font-t05 text-t05 text-secondary"
          >
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="rounded border-outline text-secondary accent-secondary focus:ring-outline-focus"
          />
          <span className="font-t05 text-t05 text-on-surface">Keep me signed in</span>
        </label>
        <button
          type="button"
          onClick={handleResetPasswordNotice}
          className="font-t05 text-t05 text-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus rounded-xs"
        >
          Reset password
        </button>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-card bg-secondary py-3.5 font-t03 text-t03 text-on-secondary hover:bg-primary hover:text-on-primary active:scale-[0.99] transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus mt-1 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Signing in...</span>
          </>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  );
}
