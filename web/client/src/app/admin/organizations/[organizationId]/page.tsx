"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"

import { useAdminAccess } from "@/lib/admin/access-provider"
import {
  canArchiveOrganization,
  getOrganization,
  listOrganizationOffices,
  organizationStatusLabel,
  suspendOrganizationAdmin,
  transitionOrganization,
  updateOrganization,
  updateOrganizationAdmin,
  type OrganizationAdmin,
  type OrganizationDetail,
  type OrganizationStatus,
} from "@/lib/admin/organizations"
import {
  OFFICE_LEVEL_LABEL,
  officeStatusLabel,
  type OfficeLevel,
  type OfficePage,
  type OfficeStatus,
} from "@/lib/admin/offices"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { DataTable, Td } from "@/components/ehelp/bits"
import { ArrowLeftIcon, CheckCircle2Icon, SearchIcon } from "lucide-react"

const BADGE_CLASS: Record<OrganizationStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  suspended: "bg-amber-100 text-amber-800",
  archived: "bg-slate-200 text-slate-700",
}

const OFFICE_BADGE_CLASS: Record<OfficeStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  archived: "bg-slate-200 text-slate-700",
}

type LifecycleAction = "suspend" | "reactivate" | "archive"

function formatAction(action: string) {
  return action.replaceAll("_", " ")
}

function OfficesSection({
  organizationId,
}: {
  organizationId: string
}) {
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [level, setLevel] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [result, setResult] = React.useState<OfficePage | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setResult(
        await listOrganizationOffices(organizationId, {
          search,
          status,
          level,
          page,
          pageSize: 10,
        }),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load offices")
    } finally {
      setLoading(false)
    }
  }, [level, organizationId, page, search, status])

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return (
    <Card id="offices">
      <CardHeader>
        <div>
          <CardTitle>Offices</CardTitle>
          <p className="text-sm text-muted-foreground">
            Search, filter, and open offices under this organization.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]"
          onSubmit={(event) => {
            event.preventDefault()
            setPage(1)
            setSearch(searchInput.trim())
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="organization-office-search">Search</Label>
            <Input
              id="organization-office-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Office name or code"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="organization-office-level">Office type</Label>
            <select
              id="organization-office-level"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={level}
              onChange={(event) => {
                setPage(1)
                setLevel(event.target.value)
              }}
            >
              <option value="">All types</option>
              {Object.entries(OFFICE_LEVEL_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="organization-office-status">Status</Label>
            <select
              id="organization-office-status"
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={status}
              onChange={(event) => {
                setPage(1)
                setStatus(event.target.value)
              }}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <Button className="self-end" type="submit" variant="outline">
            <SearchIcon /> Search
          </Button>
        </form>

        {error ? (
          <div className="flex items-center justify-between rounded-md border border-destructive p-3">
            <p className="text-sm" role="alert">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-2" aria-label="Loading offices">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            <DataTable
              headers={["Office", "Code", "Type", "Parent", "Children", "Status", "Updated", ""]}
              empty={!result?.data.length}
            >
              {(result?.data ?? []).map((office) => (
                <tr key={office.id} className="border-b last:border-0">
                  <Td className="font-medium">{office.name}</Td>
                  <Td>{office.code}</Td>
                  <Td>{OFFICE_LEVEL_LABEL[office.level as OfficeLevel]}</Td>
                  <Td className="text-muted-foreground">{office.parent_office_name ?? "None"}</Td>
                  <Td className="tabular-nums">{office.direct_child_count}</Td>
                  <Td>
                    <Badge className={OFFICE_BADGE_CLASS[office.status]}>
                      {officeStatusLabel(office.status)}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground">
                    {new Date(office.updated_at).toLocaleDateString()}
                  </Td>
                  <Td className="text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      render={<Link href={`/admin/offices/${office.id}`} />}
                    >
                      Open
                    </Button>
                  </Td>
                </tr>
              ))}
            </DataTable>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {result?.pagination.total ?? 0} office
                {(result?.pagination.total ?? 0) === 1 ? "" : "s"} · Page{" "}
                {result?.pagination.page ?? page} of {result?.pagination.total_pages ?? 1}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!result || page >= result.pagination.total_pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function AuditHistoryTable({
  audits,
}: {
  audits: OrganizationDetail["audit_history"]
}) {
  return (
    <Card id="audit">
      <CardHeader>
        <CardTitle>Organization management audit history</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          headers={["Action", "Entity", "Outcome", "Reason", "Occurred"]}
          empty={audits.length === 0}
        >
          {audits.map((audit) => (
            <tr key={audit.id} className="border-b last:border-0">
              <Td className="font-medium capitalize">{formatAction(audit.action)}</Td>
              <Td className="text-muted-foreground">
                {audit.entity_type ?? "organization"}
                {audit.entity_id ? ` · ${audit.entity_id.slice(0, 8)}` : ""}
              </Td>
              <Td>
                <Badge variant={audit.outcome === "success" ? "secondary" : "destructive"}>
                  {audit.outcome}
                </Badge>
              </Td>
              <Td className="max-w-md text-muted-foreground">
                {audit.reason || "—"}
              </Td>
              <Td className="whitespace-nowrap text-muted-foreground">
                {new Date(audit.occurred_at).toLocaleString()}
              </Td>
            </tr>
          ))}
        </DataTable>
      </CardContent>
    </Card>
  )
}

function AdminEditor({
  admin,
  organizationId,
  onUpdated,
}: {
  admin: OrganizationAdmin
  organizationId: string
  onUpdated: (detail: OrganizationDetail) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      onUpdated(
        await updateOrganizationAdmin(organizationId, admin.id, {
          full_name: String(data.get("full_name") ?? ""),
          email: String(data.get("email") ?? ""),
          phone: String(data.get("phone") ?? ""),
        }),
      )
      setEditing(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update administrator")
    } finally {
      setBusy(false)
    }
  }

  async function suspend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "")
    try {
      onUpdated(await suspendOrganizationAdmin(organizationId, admin.id, reason))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to suspend administrator")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{admin.full_name}</p>
            <Badge variant="outline">{admin.status}</Badge>
            {admin.invitation_status && (
              <Badge variant="secondary">Invitation: {admin.invitation_status}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{admin.email}</p>
          {admin.phone && <p className="text-sm text-muted-foreground">{admin.phone}</p>}
        </div>
        {admin.is_active && (
          <Button variant="outline" onClick={() => setEditing((value) => !value)}>
            {editing ? "Close" : "Manage"}
          </Button>
        )}
      </div>
      {editing && (
        <div className="mt-4 grid gap-5 border-t pt-4 lg:grid-cols-2">
          <form className="space-y-3" onSubmit={save}>
            <p className="text-sm font-medium">Edit approved metadata</p>
            <div className="space-y-1">
              <Label htmlFor={`name-${admin.id}`}>Full name</Label>
              <Input id={`name-${admin.id}`} name="full_name" defaultValue={admin.full_name} required minLength={2} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`email-${admin.id}`}>Government email</Label>
              <Input id={`email-${admin.id}`} name="email" type="email" defaultValue={admin.email} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`phone-${admin.id}`}>Phone</Label>
              <Input id={`phone-${admin.id}`} name="phone" defaultValue={admin.phone ?? ""} />
            </div>
            <Button type="submit" disabled={busy}>Save administrator</Button>
          </form>
          <form className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-3" onSubmit={suspend}>
            <p className="text-sm font-medium text-amber-950">Suspend administrator account</p>
            <p className="text-xs text-amber-900">
              This blocks the account but does not suspend the organization.
            </p>
            <Label htmlFor={`reason-${admin.id}`}>Reason</Label>
            <Input id={`reason-${admin.id}`} name="reason" required minLength={3} />
            <Button type="submit" variant="destructive" disabled={busy}>
              Confirm account suspension
            </Button>
          </form>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
    </div>
  )
}

export default function OrganizationDetailPage() {
  const params = useParams<{ organizationId: string }>()
  const searchParams = useSearchParams()
  const { isPlatformAdmin, loading: accessLoading } = useAdminAccess()
  const [organization, setOrganization] = React.useState<OrganizationDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState(false)
  const [action, setAction] = React.useState<LifecycleAction | null>(null)
  const [activeTab, setActiveTab] = React.useState<"offices" | "admins" | "audit">("offices")
  const [busy, setBusy] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!isPlatformAdmin) return
    setLoading(true)
    setError(null)
    try {
      setOrganization(await getOrganization(params.organizationId))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load organization")
    } finally {
      setLoading(false)
    }
  }, [isPlatformAdmin, params.organizationId])

  React.useEffect(() => {
    if (!accessLoading) {
      const timer = window.setTimeout(() => void load(), 0)
      return () => window.clearTimeout(timer)
    }
  }, [accessLoading, load])

  async function saveOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    try {
      setOrganization(
        await updateOrganization(params.organizationId, {
          name: String(data.get("name") ?? ""),
          code: String(data.get("code") ?? ""),
        }),
      )
      setEditing(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update organization")
    } finally {
      setBusy(false)
    }
  }

  async function applyLifecycle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!action) return
    setBusy(true)
    setError(null)
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "")
    try {
      setOrganization(
        await transitionOrganization(params.organizationId, action, reason || undefined),
      )
      setAction(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change organization status")
    } finally {
      setBusy(false)
    }
  }

  if (accessLoading || loading) return <Skeleton className="h-96 w-full" />
  if (!isPlatformAdmin) {
    return <Card><CardHeader><CardTitle>Forbidden</CardTitle></CardHeader><CardContent>Platform Administrator access is required.</CardContent></Card>
  }
  if (!organization) {
    return <Card><CardHeader><CardTitle>Organization unavailable</CardTitle></CardHeader><CardContent><p role="alert">{error}</p><Button className="mt-4" onClick={() => void load()}>Retry</Button></CardContent></Card>
  }

  return (
    <div className="space-y-5">
      <Button variant="ghost" render={<Link href="/admin/organizations" />}>
        <ArrowLeftIcon /> Organizations
      </Button>

      {searchParams.get("created") === "1" && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
          <CheckCircle2Icon className="size-4" />
          Organization and initial Organization Administrator created successfully.
        </div>
      )}
      {error && <p className="rounded-md border border-destructive p-3 text-sm" role="alert">{error}</p>}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{organization.name}</h1>
            <Badge className={BADGE_CLASS[organization.status]}>
              {organizationStatusLabel(organization.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {organization.code} · Created {new Date(organization.created_at).toLocaleString()}
          </p>
        </div>
        {organization.status !== "archived" && (
          <Button variant="outline" onClick={() => setEditing((value) => !value)}>
            {editing ? "Cancel editing" : "Edit organization"}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm">Organization Administrators</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{organization.admins.length}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Offices</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{organization.office_count}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Last updated</CardTitle></CardHeader><CardContent className="text-sm">{new Date(organization.updated_at).toLocaleString()}</CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Organization detail sections">
        <Button
          size="sm"
          variant={activeTab === "offices" ? "default" : "outline"}
          role="tab"
          aria-selected={activeTab === "offices"}
          aria-controls="organization-tab-offices"
          onClick={() => setActiveTab("offices")}
        >
          Offices
        </Button>
        <Button
          size="sm"
          variant={activeTab === "admins" ? "default" : "outline"}
          role="tab"
          aria-selected={activeTab === "admins"}
          aria-controls="organization-tab-admins"
          onClick={() => setActiveTab("admins")}
        >
          Administrators
        </Button>
        <Button
          size="sm"
          variant={activeTab === "audit" ? "default" : "outline"}
          role="tab"
          aria-selected={activeTab === "audit"}
          aria-controls="organization-tab-audit"
          onClick={() => setActiveTab("audit")}
        >
          Audit history
        </Button>
      </div>

      {editing && (
        <Card>
          <CardHeader><CardTitle>Edit organization metadata</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveOrganization}>
              <div className="space-y-2">
                <Label htmlFor="organization-name">Name</Label>
                <Input id="organization-name" name="name" defaultValue={organization.name} required minLength={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="organization-code">Code</Label>
                <Input id="organization-code" name="code" defaultValue={organization.code} required pattern="[A-Za-z0-9][A-Za-z0-9_-]+" className="uppercase" />
              </div>
              <Button className="sm:col-span-2 sm:justify-self-end" type="submit" disabled={busy}>Save changes</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "offices" && (
        <div id="organization-tab-offices" role="tabpanel">
          <OfficesSection organizationId={organization.id} />
        </div>
      )}

      {activeTab === "admins" && (
        <div id="organization-tab-admins" role="tabpanel">
          <Card id="admins">
            <CardHeader><CardTitle>Organization Administrators</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {organization.admins.map((admin) => (
                <AdminEditor key={admin.id} admin={admin} organizationId={organization.id} onUpdated={setOrganization} />
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "audit" && (
        <div id="organization-tab-audit" role="tabpanel" className="space-y-5">
          <AuditHistoryTable audits={organization.audit_history} />
          <Card>
            <CardContent className="pt-6">
              <details className="group rounded-md border border-amber-200 bg-amber-50/40 p-4">
                <summary className="cursor-pointer text-sm font-medium text-amber-950">
                  Organization lifecycle controls
                </summary>
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-amber-950/80">
                    Suspension blocks tenant operations. Archival is terminal,
                    read-only, and only available after suspension.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={organization.status !== "active"} onClick={() => setAction("suspend")}>Suspend</Button>
                    <Button variant="outline" disabled={organization.status !== "suspended"} onClick={() => setAction("reactivate")}>Reactivate</Button>
                    <Button variant="destructive" disabled={!canArchiveOrganization(organization.status)} onClick={() => setAction("archive")}>Archive</Button>
                  </div>
                  {action && (
                    <form className="space-y-3 rounded-lg border bg-background p-4" onSubmit={applyLifecycle} role="dialog" aria-labelledby="lifecycle-confirm-title">
                      <p id="lifecycle-confirm-title" className="font-medium">
                        Confirm {action} for {organization.name}
                      </p>
                      {action !== "reactivate" && (
                        <div className="space-y-2">
                          <Label htmlFor="lifecycle-reason">Reason</Label>
                          <Input id="lifecycle-reason" name="reason" required minLength={3} autoFocus />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => setAction(null)}>Cancel</Button>
                        <Button type="submit" variant={action === "archive" ? "destructive" : "default"} disabled={busy}>
                          Confirm {action}
                        </Button>
                      </div>
                    </form>
                  )}
                  {organization.lifecycle_reason && (
                    <p className="text-sm text-amber-950">Latest lifecycle reason: {organization.lifecycle_reason}</p>
                  )}
                </div>
              </details>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
