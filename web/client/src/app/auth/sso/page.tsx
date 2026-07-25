import { Suspense } from "react";

import WebSsoClient from "./sso-client";

export default function WebSsoPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[50vh] max-w-md items-center justify-center px-6 py-16 text-center text-sm text-muted-foreground">
          Completing eGov SSO…
        </main>
      }
    >
      <WebSsoClient />
    </Suspense>
  );
}
