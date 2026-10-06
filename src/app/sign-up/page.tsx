import { GOOGLE_SIGN_IN_ENABLED } from "@/lib/auth/server";
import { signupMode } from "@/lib/auth/signup";
import { safeFrom } from "@/components/auth/safeFrom";
import { SignUpForm } from "./SignUpForm";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  return <SignUpForm googleEnabled={GOOGLE_SIGN_IN_ENABLED} from={safeFrom(from)} inviteOnly={signupMode() === "invite-only"} />;
}
