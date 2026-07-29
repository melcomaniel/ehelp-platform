"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

import { useAdminAccess } from "@/lib/admin/access-provider";
import {
  OFFICE_LEVEL_LABEL,
  approveStaffRequest,
  archiveOffice,
  archiveRegionalOffice,
  canArchiveOffice,
  getOffice,
  listParentOfficeOptions,
  officeStatusLabel,
  reactivateOffice,
  reactivateRegionalOffice,
  updateOffice,
  type OfficeDetail,
  type OfficeLevel,
  type OfficeStatus,
  type ParentOfficeOption,
} from "@/lib/admin/offices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";

const BADGE_CLASS: Record<OfficeStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  archived: "bg-slate-200 text-slate-700",
};

export default function OfficeDetailPage() {
  const params = useParams<{ officeId: string }>();
  const searchParams = useSearchParams();
  const { profile, loading: accessLoading } = useAdminAccess();
  const isOrgAdmin = profile?.role === "dswd_admin";
  const [office, setOffice] = React.useState<OfficeDetail | null>(null);
  const [parents, setParents] = React.useState<ParentOfficeOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [action, setAction] = React.useState<"archive" | "reactivate" | null>(
    null,
  );
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!isOrgAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const detail = await getOffice(params.officeId);
      setOffice(detail);
      const parentOptions = await listParentOfficeOptions(params.officeId);
      setParents(parentOptions.data);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load office",
      );
    } finally {
      setLoading(false);
    }
  }, [isOrgAdmin, params.officeId]);

  React.useEffect(() => {
    if (!accessLoading) {
      const timer = window.setTimeout(() => void load(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [accessLoading, load]);

  async function saveOffice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const parentOfficeId = String(data.get("parent_office_id") ?? "");
    try {
      setOffice(
        await updateOffice(params.officeId, {
          name: String(data.get("name") ?? ""),
          code: String(data.get("code") ?? ""),
          level: String(data.get("level") ?? "municipal") as OfficeLevel,
          parent_office_id: parentOfficeId || null,
        }),
      );
      setEditing(false);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update office",
      );
    } finally {
      setBusy(false);
    }
  }

  const [approvingId, setApprovingId] = React.useState<string | null>(null);

  async function approveStaff(userId: string) {
    if (!office) return;
    setApprovingId(userId);
    setError(null);
    try {
      await approveStaffRequest(office.organization_id, params.officeId, userId);
      setOffice(await getOffice(params.officeId));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to approve staff request",
      );
    } finally {
      setApprovingId(null);
    }
  }

  async function applyLifecycle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || !office) return;
    setBusy(true);
    setError(null);
    const reason = String(
      new FormData(event.currentTarget).get("reason") ?? "",
    );
    try {
      setOffice(
        action === "archive"
          ? office.level === "regional"
            ? await archiveRegionalOffice(
                office.organization_id,
                params.officeId,
                reason,
              )
            : await archiveOffice(params.officeId, reason)
          : office.level === "regional"
            ? await reactivateRegionalOffice(
                office.organization_id,
                params.officeId,
              )
            : await reactivateOffice(params.officeId),
      );
      setAction(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to change office status",
      );
    } finally {
      setBusy(false);
    }
  }

  if (accessLoading || loading) return <Skeleton className="h-96 w-full" />;
  if (!isOrgAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Forbidden</CardTitle>
        </CardHeader>
        <CardContent>
          Organization Administrator access is required.
        </CardContent>
      </Card>
    );
  }
  if (!office) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Office unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <p role="alert">{error}</p>
          <Button className="mt-4" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" render={<Link href="/admin/offices" />}>
        <ArrowLeftIcon /> Offices
      </Button>

      {searchParams.get("created") === "1" && (
        <div
          className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900"
          role="status"
        >
          <CheckCircle2Icon className="size-4" />
          Office created successfully.
        </div>
      )}
      {error && (
        <p
          className="rounded-md border border-destructive p-3 text-sm"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{office.name}</h1>
            <Badge className={BADGE_CLASS[office.status]}>
              {officeStatusLabel(office.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {office.code} · {OFFICE_LEVEL_LABEL[office.level]} ·{" "}
            {office.organization_name}
          </p>
        </div>
        {office.status === "active" && (
          <Button
            variant="outline"
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? "Cancel editing" : "Edit office"}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Parent office</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {office.parent_office_name ?? "None"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Direct child offices</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {office.direct_child_count}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Last updated</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {new Date(office.updated_at).toLocaleString()}
          </CardContent>
        </Card>
      </div>

      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>Edit office</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveOffice}>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="office-name">Name</Label>
                <Input
                  id="office-name"
                  name="name"
                  defaultValue={office.name}
                  required
                  minLength={2}
                  maxLength={160}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="office-code">Code</Label>
                <Input
                  id="office-code"
                  name="code"
                  defaultValue={office.code}
                  required
                  maxLength={40}
                  className="uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="office-level">Office type</Label>
                <select
                  id="office-level"
                  name="level"
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  defaultValue={office.level}
                >
                  {Object.entries(OFFICE_LEVEL_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="parent_office_id">Parent office</Label>
                <select
                  id="parent_office_id"
                  name="parent_office_id"
                  className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  defaultValue={office.parent_office_id ?? ""}
                >
                  <option value="">No parent office</option>
                  {parents.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name} ({parent.code})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                className="sm:col-span-2 sm:justify-self-end"
                type="submit"
                disabled={busy}
              >
                Save changes
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Office lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={!canArchiveOffice(office)}
              onClick={() => setAction("archive")}
            >
              {office.level === "regional"
                ? "Archive Regional Office"
                : "Archive Office"}
            </Button>
            <Button
              variant="outline"
              disabled={office.status !== "archived"}
              onClick={() => setAction("reactivate")}
            >
              Reactivate
            </Button>
          </div>
          {office.status === "active" && office.direct_child_count > 0 && (
            <p className="text-sm text-muted-foreground">
              Archive child offices before archiving this office.
            </p>
          )}
          {action && (
            <form
              className="space-y-3 rounded-lg border p-4"
              onSubmit={applyLifecycle}
              role="dialog"
              aria-labelledby="office-lifecycle-title"
            >
              <p id="office-lifecycle-title" className="font-medium">
                {action === "archive" && office.level === "regional"
                  ? `Confirm Archive Regional Office for ${office.name}`
                  : `Confirm ${action} for ${office.name}`}
              </p>
              {action === "archive" && (
                <div className="space-y-2">
                  <Label htmlFor="office-lifecycle-reason">Reason</Label>
                  <Input
                    id="office-lifecycle-reason"
                    name="reason"
                    required
                    minLength={3}
                    autoFocus
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAction(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={action === "archive" ? "destructive" : "default"}
                  disabled={busy}
                >
                  {action === "archive" && office.level === "regional"
                    ? "Archive Regional Office"
                    : `Confirm ${action}`}
                </Button>
              </div>
            </form>
          )}
          {office.lifecycle_reason && (
            <p className="text-sm">
              Latest lifecycle reason: {office.lifecycle_reason}
            </p>
          )}
        </CardContent>
      </Card>

      {office.level === "regional" && (
        <Card>
          <CardHeader>
            <CardTitle>Regional Administrator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {office.office_admins.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No Regional Administrator assigned yet.
              </p>
            ) : (
              <div className="space-y-2">
                {office.office_admins.map((admin) => (
                  <div
                    key={admin.id}
                    className="rounded-md border p-3 text-sm"
                  >
                    <p className="font-medium">{admin.full_name}</p>
                    <p className="text-muted-foreground">{admin.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Account: {admin.status} · Invitation: {admin.invitation_status ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Create or assign Regional Administrators from Admin → Accounts.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Officer account requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {office.staff_requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Evaluator/Approver requests for this office yet.
            </p>
          ) : (
            <div className="space-y-2">
              {office.staff_requests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col justify-between gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-medium">
                      {request.full_name}{" "}
                      <span className="text-muted-foreground">
                        ({request.role === "EVALUATOR" ? "Evaluator" : "Approver"})
                      </span>
                    </p>
                    <p className="text-muted-foreground">{request.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Account: {request.status} · Invitation:{" "}
                      {request.invitation_status ?? "—"}
                    </p>
                  </div>
                  {request.status === "pending" && (
                    <Button
                      size="sm"
                      disabled={approvingId === request.id}
                      onClick={() => void approveStaff(request.id)}
                    >
                      Approve
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Regional Admins request Officer accounts for their own office;
            approval here starts the standard device-registration flow before
            the account can log in.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Direct child offices</CardTitle>
        </CardHeader>
        <CardContent>
          {office.child_offices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No direct child offices.
            </p>
          ) : (
            <div className="space-y-2">
              {office.child_offices.map((child) => (
                <Link
                  key={child.id}
                  href={`/admin/offices/${child.id}`}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-muted/40"
                >
                  <span className="font-medium">{child.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {child.code}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Office audit history</CardTitle>
        </CardHeader>
        <CardContent>
          {office.audit_history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No office audit events.
            </p>
          ) : (
            <div className="space-y-3">
              {office.audit_history.map((audit) => (
                <div
                  key={audit.id}
                  className="grid gap-1 border-b pb-3 last:border-0 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {audit.action.replaceAll("_", " ")}
                    </p>
                    {audit.reason && (
                      <p className="text-xs text-muted-foreground">
                        Reason: {audit.reason}
                      </p>
                    )}
                  </div>
                  <time className="text-xs text-muted-foreground">
                    {new Date(audit.occurred_at).toLocaleString()}
                  </time>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
