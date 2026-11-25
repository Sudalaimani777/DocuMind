import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { SignUpForm } from '../components/SignUpForm';

/**
 * Public Sign-Up screen (/signup) matching the DocuMind editorial split-layout design.
 */
export function SignUpView() {
  return (
    <AuthSplitLayout
      title="Create account"
      subtitle="Start indexing contracts, financial models, and decks with verified citations."
      footerText="Already have an account?"
      footerLinkLabel="Sign in"
      footerLinkTo="/signin"
    >
      <SignUpForm />
    </AuthSplitLayout>
  );
}
