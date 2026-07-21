"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { fetchProfile } from "@/lib/auth/profile";
import { homeRouteForRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [useOtp, setUseOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      if (useOtp) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: trimmed,
          options: {
            shouldCreateUser: false,
          },
        });
        if (otpError) throw otpError;
        const next = safeNextPath(searchParams.get("next"));
        const otpUrl = next
          ? `/otp?email=${encodeURIComponent(trimmed)}&next=${encodeURIComponent(next)}`
          : `/otp?email=${encodeURIComponent(trimmed)}`;
        router.push(otpUrl);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (signInError) throw signInError;

      const next = safeNextPath(searchParams.get("next"));
      if (next) {
        router.replace(next);
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const profile = user ? await fetchProfile(supabase, user.id) : null;
        router.replace(homeRouteForRole(profile?.role ?? "customer"));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to check your applications and aid status
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {!useOtp && (
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
          {loading ? "Please wait…" : useOtp ? "Send OTP" : "Sign in"}
        </Button>
      </form>

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          setUseOtp((v) => !v);
          setError(null);
        }}
      >
        {useOtp ? "Use password instead" : "Sign in with email OTP"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        First time applying for aid?{" "}
        <Link
          href="/signup"
          className="font-medium text-[#0040E7] hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
