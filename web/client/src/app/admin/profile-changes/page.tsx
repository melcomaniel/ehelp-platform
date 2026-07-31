"use client";

import { useCallback, useEffect, useState } from "react";

import { nestFetch } from "@/lib/api/nest";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ProfileChangeRequest = {
  id: string;
  beneficiary_name?: string | null;
  description: string;
  proposed_changes: Record<string, unknown>;
  status: string;
  created_at: string;
  documents: Array<{ document_type: string; storage_uri: string }>;
};

export default function ProfileChangesPage() {
  const [rows, setRows] = useState<ProfileChangeRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await nestFetch<ProfileChangeRequest[]>(
        "/profile-change-requests/pending",
      );
      setRows(data);
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function decide(id: string, approve: boolean) {
    const notes =
      window.prompt(approve ? "Approval notes (optional)" : "Rejection notes") ??
      "";
    setBusy(id);
    try {
      await nestFetch(`/profile-change-requests/${id}/decide`, {
        method: "POST",
        body: { approve, notes },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Profile change requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Beneficiaries cannot edit locked details themselves. Review proof and
            description, then approve or reject.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {rows.length === 0 && !error ? (
        <p className="text-sm text-muted-foreground">No pending requests.</p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {r.beneficiary_name ?? "Beneficiary"}
                </CardTitle>
                <CardDescription>
                  {new Date(r.created_at).toLocaleString()} · {r.status}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{r.description}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Proposed changes</p>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(r.proposed_changes ?? {}).map(([k, v]) => (
                      <li key={k}>
                        <span className="text-muted-foreground">{k}: </span>
                        <span className="font-medium">{String(v ?? "—")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Proof</p>
                  <ul className="mt-1 space-y-1">
                    {(r.documents ?? []).map((d, i) => (
                      <li key={`${d.storage_uri}-${i}`}>
                        {d.document_type}: {d.storage_uri}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    disabled={busy === r.id}
                    onClick={() => void decide(r.id, true)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === r.id}
                    onClick={() => void decide(r.id, false)}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
