"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PENDING_KEY = "ehelp_pending_login_token";

export function SignInForm() {
  const router = useRouter();
  const [exchangeCode, setExchangeCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const errorId = "signin-error";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const code = exchangeCode.trim();
      if (!code) throw new Error("Paste an eGov SSO exchange code");
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
      router.replace("/auth/liveness");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold">Staff &amp; admin sign in</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Sign in with eGov SSO, then complete a face liveness check. Beneficiaries
          use the mobile app.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
        aria-describedby={error ? errorId : undefined}
      >
        <div className="grid gap-2">
          <Label htmlFor="exchange">
            eGov SSO exchange code <span className="text-destructive">*</span>
          </Label>
          <Input
            id="exchange"
            placeholder="Paste the exchange code"
            autoComplete="one-time-code"
            value={exchangeCode}
            onChange={(e) => setExchangeCode(e.target.value)}
            required
          />
          <p className="text-xs leading-5 text-muted-foreground">
            With Nest in mock mode, any code works for provisioned staff. In live
            mode, use a freshly minted partner exchange code. Face liveness is
            required next (human check only).
          </p>
        </div>

        {error && (
          <p
            id={errorId}
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          aria-busy={loading}
          className="w-full"
        >
          {loading ? "Checking SSO…" : "Continue to face check"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Need an account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Ask your admin
        </Link>
        {" · "}
        <Link href="/get-app" className="font-medium text-primary hover:underline">
          Get the mobile app
        </Link>
      </p>
    </div>
  );
}
