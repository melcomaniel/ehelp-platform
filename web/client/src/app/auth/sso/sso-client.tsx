"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { homeRouteForRole, parseAppRole } from "@/lib/auth/types";
import { getOrCreateDeviceFingerprint } from "@/lib/auth/device";

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
          body: JSON.stringify({
            exchange_code: code,
            device_fingerprint: getOrCreateDeviceFingerprint(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "SSO failed");
        if (cancelled) return;
        router.replace(homeRouteForRole(parseAppRole(data.user?.role)));
        router.refresh();
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
          Exchanging your code with the Nest API.
        </p>
      )}
    </main>
  );
}
