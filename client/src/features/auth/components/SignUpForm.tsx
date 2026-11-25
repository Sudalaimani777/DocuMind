import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { signupSchema } from '@documind/shared';
import { cn } from '../../../core/lib/utils';
import { useSignUp } from '../hooks/useSignUp';

const signUpFormSchema = signupSchema.extend({
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the Enterprise Terms of Service to continue.',
  }),
});

type SignUpFormValues = z.infer<typeof signUpFormSchema>;

/**
 * Validated Sign-Up form wired to POST /api/v1/auth/signup via React Hook Form + Zod.
 */
export function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const { submitSignUp, isPending, errorMessage, resetError } = useSignUp();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      name: '',
      organization: '',
      email: '',
      password: '',
      acceptTerms: false,
    },
  });

  const onSubmit = async (values: SignUpFormValues) => {
    resetError();
    try {
      const { acceptTerms: _accepted, ...payload } = values;
      await submitSignUp(payload);
    } catch {
      // Error message is surfaced via errorMessage state from useSignUp
    }
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-15">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="signup-name"
            className="font-t05 text-t05 text-on-surface-variant"
          >
            Full Name
          </label>
          <div
            className={cn(
              'rounded-card border bg-surface-subtle/60 transition-colors focus-within:border-outline-focus focus-within:bg-surface',
              errors.name ? 'border-secondary' : 'border-outline'
            )}
          >
            <input
              id="signup-name"
              type="text"
              autoComplete="name"
              placeholder="Elena Rostova"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'signup-name-error' : undefined}
              className="w-full bg-transparent border-0 px-15 py-3 rounded-card text-on-surface placeholder:text-on-surface-variant font-t04 text-t04 focus:outline-none focus:ring-0"
              {...register('name')}
            />
          </div>
          {errors.name ? (
            <p id="signup-name-error" role="alert" className="font-t05 text-t05 text-secondary">
              {errors.name.message}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="signup-org"
            className="font-t05 text-t05 text-on-surface-variant"
          >
            Organization
          </label>
          <div
            className={cn(
              'rounded-card border bg-surface-subtle/60 transition-colors focus-within:border-outline-focus focus-within:bg-surface',
              errors.organization ? 'border-secondary' : 'border-outline'
            )}
          >
            <input
              id="signup-org"
              type="text"
              autoComplete="organization"
              placeholder="Acme Global"
              aria-invalid={Boolean(errors.organization)}
              aria-describedby={errors.organization ? 'signup-org-error' : undefined}
              className="w-full bg-transparent border-0 px-15 py-3 rounded-card text-on-surface placeholder:text-on-surface-variant font-t04 text-t04 focus:outline-none focus:ring-0"
              {...register('organization')}
            />
          </div>
          {errors.organization ? (
            <p id="signup-org-error" role="alert" className="font-t05 text-t05 text-secondary">
              {errors.organization.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="signup-email"
          className="font-t05 text-t05 text-on-surface-variant"
        >
          Work Email
        </label>
        <div
          className={cn(
            'rounded-card border bg-surface-subtle/60 transition-colors focus-within:border-outline-focus focus-within:bg-surface',
            errors.email ? 'border-secondary' : 'border-outline'
          )}
        >
          <input
            id="signup-email"
            type="email"
            autoComplete="email"
            placeholder="Enter your work email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'signup-email-error' : undefined}
            className="w-full bg-transparent border-0 px-20 py-3.5 rounded-card text-on-surface placeholder:text-on-surface-variant font-t04 text-t04 focus:outline-none focus:ring-0"
            {...register('email')}
          />
        </div>
        {errors.email ? (
          <p id="signup-email-error" role="alert" className="font-t05 text-t05 text-secondary">
            {errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="signup-password"
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
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'signup-password-error' : undefined}
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
          <p id="signup-password-error" role="alert" className="font-t05 text-t05 text-secondary">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1 pt-1">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            aria-invalid={Boolean(errors.acceptTerms)}
            aria-describedby={errors.acceptTerms ? 'signup-terms-error' : undefined}
            className="mt-0.5 rounded border-outline text-secondary accent-secondary focus:ring-outline-focus"
            {...register('acceptTerms')}
          />
          <span className="font-t05 text-t05 text-on-surface-variant text-pretty">
            I agree to the Enterprise Terms of Service and Zero-Retention Data Processing Addendum.
          </span>
        </label>
        {errors.acceptTerms ? (
          <p id="signup-terms-error" role="alert" className="font-t05 text-t05 text-secondary">
            {errors.acceptTerms.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-card bg-secondary py-3.5 font-t03 text-t03 text-on-secondary hover:bg-primary hover:text-on-primary active:scale-[0.99] transition-colors duration-instant ease-instant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-outline-focus mt-1 disabled:opacity-60 disabled:pointer-events-none flex items-center justify-center gap-2"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Creating account...</span>
          </>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  );
}
