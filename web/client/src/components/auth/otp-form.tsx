"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { fetchProfile } from "@/lib/auth/profile";
import { homeRouteForRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function OtpForm({
  email,
  next,
}: {
  email: string;
  next?: string;
}) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !token.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: token.trim(),
        type: "email",
      });
      if (verifyError) throw verifyError;

      const destination = safeNextPath(next);
      if (destination) {
        router.replace(destination);
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

  if (!email) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-semibold">Verify OTP</h1>
        <p className="text-sm text-muted-foreground">
          Missing email. Start again from sign in.
        </p>
        <Link
          href="/signin"
          className="font-medium text-[#0040E7] hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold">Verify OTP</h1>
        <p className="text-sm text-muted-foreground">
          Enter the code sent to {email}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="otp">OTP code</Label>
          <Input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
          />
        </div>

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
          {loading ? "Verifying…" : "Verify"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/signin"
          className="font-medium text-[#0040E7] hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
