"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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

type ApplicationDetail = NestApplication & {
  form_data?: Record<string, unknown>;
  form_fields?: Array<{
    key: string;
    label: string;
    type: string;
    options?: string[];
  }>;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_birth_date?: string | null;
  customer_address?: string | null;
  customer_municipality?: string | null;
  customer_barangay?: string | null;
  amount_requested?: number | null;
  amount_approved?: number | null;
  evaluator_notes?: string | null;
  approver_notes?: string | null;
  submitted_at?: string | null;
  template_code?: string | null;
};

export default function StaffApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [mode, setMode] = useState<StaffMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const session = await fetch("/api/auth/session", { cache: "no-store" });
      if (!session.ok) throw new Error("Session expired");
      const data = await session.json();
      const role = data.user?.role as string | undefined;
      setMode(role === "approver" ? "approver" : "evaluator");
      const detail = await nestFetch<ApplicationDetail>(`/applications/${id}`);
      setApp(detail);
    } catch (e) {
      setApp(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function recommend() {
    if (!app) return;
    const notes = window.prompt("Evaluation notes (endorse)") ?? "";
    setBusy(true);
    try {
      await nestFetch(`/applications/${app.id}/recommend`, {
        method: "POST",
        body: { notes, priority: "medium" },
      });
      router.push("/staff");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function declineEvaluation() {
    if (!app) return;
    const notes =
      window.prompt("Decline reason (required for the beneficiary)") ?? "";
    if (!notes.trim()) {
      setError("A decline reason is required.");
      return;
    }
    setBusy(true);
    try {
      await nestFetch(`/applications/${app.id}/decline`, {
        method: "POST",
        body: { notes: notes.trim() },
      });
      router.push("/staff");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function decide(approve: boolean) {
    if (!app) return;
    const notes =
      window.prompt(
        approve ? "Approval notes" : "Decline reason (shown to beneficiary)",
      ) ?? "";
    if (!approve && !notes.trim()) {
      setError("A decline reason is required.");
      return;
    }
    setBusy(true);
    try {
      await nestFetch(`/applications/${app.id}/decide`, {
        method: "POST",
        body: { approve, notes },
      });
      router.push("/staff");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const fields = app?.form_fields?.length
    ? app.form_fields
    : Object.keys(app?.form_data ?? {}).map((key) => ({
        key,
        label: key,
        type: "text",
        options: [] as string[],
      }));

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">EHelp · Staff</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Application detail
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Full beneficiary submission for review.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" render={<Link href="/staff" />}>
            Back to queue
          </Button>
          <SignOutButton className="rounded-lg border px-3 py-1.5 text-sm" />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {!app && !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}

      {app ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {app.reference_no || app.id.slice(0, 8)}
              </CardTitle>
              <CardDescription>
                {app.template_name ?? "Program"}
                {app.template_code ? ` (${app.template_code})` : ""} ·{" "}
                <span className="font-medium">{app.status}</span>
                <span className="block mt-1 font-normal text-muted-foreground">
                  Contact and address below are the beneficiary&apos;s current
                  records (updated after approved profile-change requests).
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Beneficiary</p>
                <p className="font-medium">{app.customer_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contact</p>
                <p>{app.customer_phone || app.customer_email || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Birth date</p>
                <p>{app.customer_birth_date || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p>
                  {[app.customer_barangay, app.customer_municipality]
                    .filter(Boolean)
                    .join(", ") ||
                    app.customer_address ||
                    "—"}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Address</p>
                <p>{app.customer_address || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount requested</p>
                <p className="tabular-nums">
                  {app.amount_requested != null
                    ? app.amount_requested.toLocaleString()
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Submitted</p>
                <p>
                  {app.submitted_at
                    ? new Date(app.submitted_at).toLocaleString()
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application answers</CardTitle>
              <CardDescription>
                Fields the beneficiary submitted for this program.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No form answers recorded for this application.
                </p>
              ) : (
                fields.map((field) => {
                  const raw = app.form_data?.[field.key];
                  const display =
                    raw == null || raw === ""
                      ? "—"
                      : typeof raw === "object"
                        ? JSON.stringify(raw)
                        : String(raw);
                  return (
                    <div
                      key={field.key}
                      className="rounded-md border px-3 py-2 text-sm"
                    >
                      <p className="text-xs font-medium text-muted-foreground">
                        {field.label}
                      </p>
                      <p className="mt-0.5 font-medium">{display}</p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {(app.evaluator_notes || app.approver_notes) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Staff notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {app.evaluator_notes ? (
                  <p>
                    <span className="text-muted-foreground">Evaluator: </span>
                    {app.evaluator_notes}
                  </p>
                ) : null}
                {app.approver_notes ? (
                  <p>
                    <span className="text-muted-foreground">Approver: </span>
                    {app.approver_notes}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            {mode === "evaluator" ? (
              <>
                <Button size="sm" disabled={busy} onClick={() => void recommend()}>
                  Endorse for approval
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void declineEvaluation()}
                >
                  Decline
                </Button>
              </>
            ) : null}
            {mode === "approver" ? (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void decide(true)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void decide(false)}
                >
                  Decline
                </Button>
              </>
            ) : null}
          </div>
          {mode ? (
            <p className="text-xs text-muted-foreground">
              {mode === "evaluator"
                ? "Endorse sends the case to Approver. Decline ends the application; the beneficiary can apply again when eligible."
                : "Approve unlocks disbursement scheduling. Decline ends the application; the beneficiary can apply again when eligible."}
            </p>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
