"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const PENDING_KEY = "ehelp_pending_login_token";

export default function WebSsoClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("exchange_code")?.trim() ?? "";
  const [error, setError] = useState<string | null>(
    code ? null : "Missing exchange_code",
  );

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/sso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exchange_code: code }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "SSO failed");
        if (!data.pending_login_token) {
          throw new Error("SSO did not return a pending login token");
        }
        sessionStorage.setItem(PENDING_KEY, data.pending_login_token);
        if (cancelled) return;
        router.replace("/auth/liveness");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Completing eGov SSO…</h1>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Exchanging your code, then face liveness.
        </p>
      )}
    </main>
  );
}
