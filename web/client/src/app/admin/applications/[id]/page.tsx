"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { EmptyState, PageHeader, StatusPill } from "@/components/ehelp/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { nestFetch, type NestApplication } from "@/lib/api/nest";
import { ArrowLeftIcon, FileTextIcon } from "lucide-react";

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    under_review: "Under review",
    recommended: "For approval",
    approved: "Approved",
    claimed: "Claimed",
    disbursed: "Disbursed",
    declined: "Declined",
    cancelled: "Cancelled",
  };
  return map[status] ?? status;
}

export default function AdminApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<NestApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const row = await nestFetch<NestApplication>(`/applications/${id}`);
      setApp(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setApp(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  if (loading && !app) {
    return (
      <Card>
        <CardContent className="py-10 text-sm text-muted-foreground">
          Loading application…
        </CardContent>
      </Card>
    );
  }

  if (error || !app) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="Application not found"
            description={error || "The selected application may have been removed."}
            icon={<FileTextIcon className="size-5" aria-hidden />}
          >
            <Button variant="outline" render={<Link href="/admin/applications" />}>
              <ArrowLeftIcon /> Applications
            </Button>
          </EmptyState>
        </CardContent>
      </Card>
    );
  }

  const claim = app.disbursement_claim;
  const booking = app.disbursement_booking;
  const complete =
    app.status === "claimed" ||
    app.status === "disbursed" ||
    Boolean(claim);

  return (
    <div className="space-y-5">
      <PageHeader
        title={app.reference_no}
        description={`${app.customer_name ?? "Beneficiary"} · ${
          app.template_name ?? app.template_code ?? "Program"
        }`}
      >
        <div className="flex items-center gap-2">
          <StatusPill value={statusLabel(app.status)} />
          <Button size="sm" variant="ghost" render={<Link href="/admin/applications" />}>
            <ArrowLeftIcon /> Applications
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="grid gap-x-6 gap-y-3 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label="Status" value={<StatusPill value={statusLabel(app.status)} />} />
          <DetailItem
            label="Submitted"
            value={
              app.submitted_at
                ? new Date(app.submitted_at).toLocaleString()
                : "—"
            }
          />
          <DetailItem
            label="Decided"
            value={
              app.decided_at ? new Date(app.decided_at).toLocaleString() : "—"
            }
          />
          <DetailItem label="Stage" value={app.current_stage_type ?? "—"} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Application details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <DetailItem label="Case number" value={app.reference_no} mono />
            <DetailItem label="Program" value={app.template_name ?? "—"} />
            <DetailItem label="Program code" value={app.template_code ?? "—"} mono />
            <DetailItem
              label="Amount requested"
              value={
                app.amount_requested != null
                  ? `₱${Number(app.amount_requested).toLocaleString()}`
                  : "—"
              }
            />
            <DetailItem
              label="Amount approved"
              value={
                app.amount_approved != null
                  ? `₱${Number(app.amount_approved).toLocaleString()}`
                  : "—"
              }
            />
            <DetailItem
              label="Evaluator notes"
              value={app.evaluator_notes || "—"}
              wide
            />
            <DetailItem
              label="Approver notes"
              value={app.approver_notes || "—"}
              wide
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Beneficiary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
            <DetailItem label="Name" value={app.customer_name ?? "—"} />
            <DetailItem label="Phone" value={app.customer_phone ?? "—"} />
            <DetailItem label="Email" value={app.customer_email ?? "—"} />
            <DetailItem
              label="Municipality"
              value={app.customer_municipality ?? "—"}
            />
            <DetailItem label="Barangay" value={app.customer_barangay ?? "—"} />
            <DetailItem
              label="Address"
              value={app.customer_address ?? "—"}
              wide
            />
          </CardContent>
        </Card>
      </div>

      {complete ? (
        <Card>
          <CardHeader>
            <CardTitle>Disbursement completed</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem
              label="Claimed at"
              value={
                claim?.claimed_at
                  ? new Date(claim.claimed_at).toLocaleString()
                  : booking?.validated_at
                    ? new Date(booking.validated_at).toLocaleString()
                    : "—"
              }
            />
            <DetailItem
              label="Queue #"
              value={String(
                claim?.queue_number ?? booking?.queue_number ?? "—",
              )}
            />
            <DetailItem
              label="Face liveness"
              value={
                claim?.face_liveness_passed
                  ? "Verified at cash window"
                  : "Recorded"
              }
            />
            <DetailItem
              label="Slot"
              value={
                claim?.slot_starts_at
                  ? `${new Date(claim.slot_starts_at).toLocaleString()} → ${
                      claim.slot_ends_at
                        ? new Date(claim.slot_ends_at).toLocaleString()
                        : "—"
                    }`
                  : booking?.slot_starts_at
                    ? `${new Date(booking.slot_starts_at).toLocaleString()} → ${
                        booking.slot_ends_at
                          ? new Date(booking.slot_ends_at).toLocaleString()
                          : "—"
                      }`
                    : "—"
              }
              wide
            />
            <DetailItem
              label="Site"
              value={
                [claim?.site_name ?? booking?.site_name, claim?.site_address ?? booking?.site_address]
                  .filter(Boolean)
                  .join(" — ") || "—"
              }
              wide
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className={mono ? "font-mono text-xs" : "font-medium"}>{value}</div>
    </div>
  );
}
