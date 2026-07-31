"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { nestFetch, type NestApplication } from "@/lib/api/nest";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type StaffMode = "evaluator" | "approver";

/**
 * Staff console (Evaluator / Approver) — Nest queue via session JWT cookie proxy.
 * Mode is derived from Nest session role (no free toggle — backend is source of truth).
 */
export default function StaffConsolePage() {
  const [queue, setQueue] = useState<NestApplication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<StaffMode | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await fetch("/api/auth/session", { cache: "no-store" });
      if (!session.ok) {
        throw new Error("Session expired");
      }
      const data = await session.json();
      setProfileName(data.user?.fullName ?? data.user?.email ?? null);
      const role = data.user?.role as string | undefined;
      const nextMode: StaffMode =
        role === "approver" ? "approver" : "evaluator";
      setMode(nextMode);

      const statuses =
        nextMode === "approver"
          ? "recommended,in_approval"
          : "submitted,under_review,in_evaluation";
      const apps = await nestFetch<NestApplication[]>(
        `/applications/queue?statuses=${encodeURIComponent(statuses)}`,
      );
      setQueue(Array.isArray(apps) ? apps : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-3xl space-y-6 px-6 py-10 outline-none"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">EHelp · Staff</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Case queue
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profileName ? `Signed in as ${profileName}. ` : null}
            {mode === "approver"
              ? "Approver queue — open a case to review the full application, then decide."
              : mode === "evaluator"
                ? "Evaluator queue — open a case to review answers, then endorse."
                : "Loading role…"}{" "}
            Admins manage programs at{" "}
            <Link href="/admin" className="underline">
              /admin
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode ? (
            <span className="rounded-md border px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
              {mode}
            </span>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <SignOutButton className="rounded-lg border px-3 py-1.5 text-sm" />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          We could not load the case queue. Please try again.
        </p>
      ) : null}

      <ul className="space-y-3">
        {queue.length === 0 && !loading ? (
          <li className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No cases in queue.
          </li>
        ) : null}
        {queue.map((app) => (
          <li key={app.id}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {app.reference_no || app.id.slice(0, 8)}
                </CardTitle>
                <CardDescription>
                  {app.template_name ?? "Program"} ·{" "}
                  {app.customer_name ?? "—"} ·{" "}
                  <span className="font-medium">{app.status}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  render={<Link href={`/staff/applications/${app.id}`} />}
                >
                  Open application
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
