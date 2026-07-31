"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { homeRouteForRole, parseAppRole } from "@/lib/auth/types";
import { getOrCreateDeviceFingerprint } from "@/lib/auth/device";
import { Button } from "@/components/ui/button";

const PENDING_KEY = "ehelp_pending_login_token";

export default function AuthLivenessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackToken = searchParams.get("token")?.trim() ?? "";
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Preparing face check…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const pending = sessionStorage.getItem(PENDING_KEY);
      if (!pending) {
        setError("Missing pending SSO session. Sign in again.");
        return;
      }

      // Callback from Nest mock/live liveness UI with ?token=
      if (callbackToken) {
        setStatus("Confirming face liveness…");
        try {
          const res = await fetch("/api/auth/login/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pending_login_token: pending,
              liveness_session_token: callbackToken,
              device_fingerprint: getOrCreateDeviceFingerprint(),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.message || "Login complete failed");
          sessionStorage.removeItem(PENDING_KEY);
          if (cancelled) return;
          router.replace(homeRouteForRole(parseAppRole(data.user?.role)));
          router.refresh();
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : String(e));
          }
        }
        return;
      }

      // Start liveness session and redirect to Nest UI
      setStatus("Starting face liveness…");
      try {
        const callbackUrl = `${window.location.origin}/auth/liveness`;
        const res = await fetch("/api/auth/liveness/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pending_login_token: pending,
            callback_url: callbackUrl,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Could not start liveness");
        if (!data.url) throw new Error("Liveness URL missing");
        if (cancelled) return;
        window.location.href = data.url as string;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [callbackToken, router]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Face liveness check</h1>
      {error ? (
        <>
          <p className="text-sm text-destructive">{error}</p>
          <Button render={<Link href="/signin" />}>Back to sign in</Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{status}</p>
      )}
      {!callbackToken && !error && (
        <p className="max-w-sm text-xs text-muted-foreground">
          After verification you should return here automatically. If you stay on
          eGov “Verification Complete”, sign in again after Nest reloads (sessions
          now use <code className="text-[11px]">action=redirect</code>).
        </p>
      )}
    </main>
  );
}
