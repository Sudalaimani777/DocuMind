import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { SignInForm } from '../components/SignInForm';

/**
 * Public Sign-In screen (/signin) matching the DocuMind editorial split-layout design.
 */
export function SignInView() {
  return (
    <AuthSplitLayout
      title="Welcome back"
      subtitle="Access your grounded document vault, clause intelligence, and AI assistant."
      footerText="New to DocuMind?"
      footerLinkLabel="Create Account"
      footerLinkTo="/signup"
    >
      <SignInForm />
    </AuthSplitLayout>
  );
}
