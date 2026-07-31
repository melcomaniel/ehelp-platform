import { Suspense } from "react";

import AuthLivenessClient from "./liveness-client";

export default function AuthLivenessPage() {
  return (
    <Suspense
      fallback={
        <p className="p-10 text-center text-sm text-muted-foreground">
          Loading…
        </p>
      }
    >
      <AuthLivenessClient />
    </Suspense>
  );
}
