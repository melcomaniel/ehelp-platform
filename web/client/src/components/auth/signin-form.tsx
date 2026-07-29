"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { homeRouteForRole, parseAppRole } from "@/lib/auth/types";
import { getOrCreateDeviceFingerprint } from "@/lib/auth/device";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"password" | "sso">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [exchangeCode, setExchangeCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function finish(user: { role?: string }) {
    const next = safeNextPath(searchParams.get("next"));
    router.replace(next ?? homeRouteForRole(parseAppRole(user.role)));
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "sso") {
        const code = exchangeCode.trim();
        if (!code) throw new Error("Paste an eGov SSO exchange code");
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
        await finish(data.user ?? {});
        return;
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          device_fingerprint: getOrCreateDeviceFingerprint(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Sign in failed");
      await finish(data.user ?? {});
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
        <p className="text-sm text-muted-foreground">
          Nest-backed portal for evaluators, approvers, and admins. Beneficiaries
          use the mobile app.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === "password" ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@agency.gov.ph"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="exchange">eGov SSO exchange code</Label>
            <Input
              id="exchange"
              placeholder="Paste exchange_code"
              value={exchangeCode}
              onChange={(e) => setExchangeCode(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Your account must already be provisioned by an admin. Partner
              callback can use{" "}
              <code className="text-[11px]">/auth/egovph/sso?client=web</code>.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="w-full bg-[#0040E7] text-white hover:bg-[#0035c2]"
        >
          {loading
            ? "Please wait…"
            : mode === "sso"
              ? "Continue with SSO"
              : "Sign in"}
        </Button>
      </form>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          setMode((m) => (m === "password" ? "sso" : "password"));
          setError(null);
        }}
      >
        {mode === "sso" ? "Use email & password (mock)" : "Sign in with eGov SSO"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Need an account?{" "}
        <Link href="/signup" className="font-medium text-[#0040E7] hover:underline">
          Ask your admin
        </Link>
        {" · "}
        <Link href="/get-app" className="font-medium text-[#0040E7] hover:underline">
          Get the mobile app
        </Link>
      </p>
    </div>
  );
}
