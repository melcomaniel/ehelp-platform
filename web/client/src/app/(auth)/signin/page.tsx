import { Suspense } from "react";

import { SignInForm } from "@/components/auth/signin-form";

export default function SignInPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
      <SignInForm />
    </Suspense>
  );
}
