import { GOOGLE_SIGN_IN_ENABLED } from "@/lib/auth/server";
import { publicSignupAvailable } from "@/lib/auth/signup";
import { safeFrom } from "@/components/auth/safeFrom";
import { SignInForm } from "./SignInForm";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return <SignInForm googleEnabled={GOOGLE_SIGN_IN_ENABLED} from={safeFrom(from)} signupAvailable={await publicSignupAvailable()} />;
}
