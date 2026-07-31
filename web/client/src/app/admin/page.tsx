"use client"

import * as React from "react"
import Link from "next/link"

import { useAdminAccess } from "@/lib/admin/access-provider"
import {
  listOrganizations,
  organizationStatusLabel,
  type OrganizationPage,
  type OrganizationStatus,
  type OrganizationSummary,
} from "@/lib/admin/organizations"
import {
  nestFetch,
  type NestDashboardSummary,
} from "@/lib/api/nest"
import { APP_ROLE_LABEL } from "@/lib/auth/types"
import { PageHeader, StatusPill } from "@/components/ehelp/bits"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  Building2Icon,
  CheckCircle2Icon,
  FolderOpenIcon,
  HourglassIcon,
  LandmarkIcon,
  PlusIcon,
  ShieldCheckIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const PIPELINE_STAGES: Array<{
  key: keyof NestDashboardSummary["pipeline"]
  label: string
}> = [
  { key: "submitted", label: "Submitted" },
  { key: "under_review", label: "Under review" },
  { key: "recommended", label: "For approval" },
  { key: "approved", label: "Approved" },
  { key: "claimed", label: "Claimed" },
  { key: "declined", label: "Declined" },
]

const ORGANIZATION_STATUS_CLASS: Record<OrganizationStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  suspended: "bg-amber-100 text-amber-800",
  archived: "bg-slate-200 text-slate-700",
}

function formatRelativeDate(value: string) {
  const date = new Date(value)
  const elapsed = Date.now() - date.getTime()
  const days = Math.floor(elapsed / 86_400_000)

  if (Number.isNaN(date.getTime())) return "Unknown"
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days} days ago`
  return date.toLocaleDateString()
}

function TenantStatusBar({
  status,
  count,
  total,
}: {
  status: OrganizationStatus
  count: number
  total: number
}) {
  const percent = total ? Math.round((count / total) * 100) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{organizationStatusLabel(status)}</span>
        <span className="tabular-nums text-muted-foreground">
          {count} · {percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={
            status === "active"
              ? "h-full rounded-full bg-emerald-500"
              : status === "suspended"
                ? "h-full rounded-full bg-amber-500"
                : "h-full rounded-full bg-slate-500"
          }
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

async function listAllOrganizations() {
  const first = await listOrganizations({
    includeArchived: true,
    page: 1,
    pageSize: 100,
  })
  const pages = Array.from(
    { length: Math.max(0, first.pagination.total_pages - 1) },
    (_, index) => index + 2,
  )
  const rest = await Promise.all(
    pages.map((page) =>
      listOrganizations({ includeArchived: true, page, pageSize: 100 }),
    ),
  )

  return {
    ...first,
    data: [...first.data, ...rest.flatMap((page) => page.data)],
  }
}

function PlatformDashboard() {
  const [result, setResult] = React.useState<OrganizationPage | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setResult(await listAllOrganizations())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const organizations = result?.data ?? []
  const totalOrganizations = result?.pagination.total ?? organizations.length
  const counts = organizations.reduce<Record<OrganizationStatus, number>>(
    (acc, organization) => {
      acc[organization.status] += 1
      return acc
    },
    { active: 0, suspended: 0, archived: 0 },
  )
  const offices = organizations.reduce(
    (sum, organization) => sum + organization.office_count,
    0,
  )
  const missingAdmins = organizations.filter(
    (organization) => !organization.primary_admin_email,
  )
  const recentOrganizations = [...organizations]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, 5)

  const kpis = [
    {
      label: "Government Tenants",
      value: totalOrganizations,
      hint: `${counts.active} active`,
      icon: Building2Icon,
    },
    {
      label: "Regional Offices",
      value: offices,
      hint: "configured across listed tenants",
      icon: LandmarkIcon,
    },
    {
      label: "Suspended Tenants",
      value: counts.suspended,
      hint: "requires lifecycle review",
      icon: AlertTriangleIcon,
    },
    {
      label: "Admin Coverage",
      value: `${Math.max(0, organizations.length - missingAdmins.length)}/${organizations.length}`,
      hint: "tenants with primary admin",
      icon: ShieldCheckIcon,
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        description="Platform-level tenant health, onboarding coverage, and organization lifecycle status."
      >
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/admin/organizations" />}>
            View tenants
          </Button>
          <Button render={<Link href="/admin/organizations/new" />}>
            <PlusIcon /> Create organization
          </Button>
        </div>
      </PageHeader>

      {error ? (
        <Card className="border-destructive">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="text-sm">
              {error}
            </p>
            <Button variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid auto-rows-min gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))
          : kpis.map((kpi) => {
              const Icon = kpi.icon
              return (
                <Card key={kpi.label}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                    <CardDescription>{kpi.label}</CardDescription>
                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#0040E7]/10 text-[#0040E7]">
                      <Icon className="size-4" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="text-2xl font-semibold tabular-nums">
                      {kpi.value}
                    </div>
                    <div className="text-xs text-muted-foreground">{kpi.hint}</div>
                  </CardContent>
                </Card>
              )
            })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tenant Lifecycle</CardTitle>
            <CardDescription>
              Current status distribution across government organizations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </>
            ) : (
              (["active", "suspended", "archived"] as OrganizationStatus[]).map(
                (status) => (
                  <TenantStatusBar
                    key={status}
                    status={status}
                    count={counts[status]}
                    total={organizations.length}
                  />
                ),
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational Attention</CardTitle>
            <CardDescription>
              Tenant setup gaps that affect administration readiness.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <CheckCircle2Icon className="mt-0.5 size-4 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Active tenant operations</p>
                    <p className="text-sm text-muted-foreground">
                      {counts.active} tenant{counts.active === 1 ? "" : "s"} available for
                      organization administration.
                    </p>
                  </div>
                </div>
                <Link
                  href={
                    missingAdmins[0]
                      ? `/admin/organizations/${missingAdmins[0].id}`
                      : "/admin/organizations"
                  }
                  className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
                >
                  <AlertTriangleIcon className="mt-0.5 size-4 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Primary admin gaps</p>
                    <p className="text-sm text-muted-foreground">
                      {missingAdmins.length} tenant{missingAdmins.length === 1 ? "" : "s"} need
                      a primary Organization Administrator.
                    </p>
                  </div>
                  <ArrowRightIcon className="mt-1 size-4 text-muted-foreground" />
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recently Updated Tenants</CardTitle>
          <CardDescription>
            Latest organization records visible to Platform Administration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : recentOrganizations.length ? (
            <div className="overflow-hidden rounded-xl border">
              {recentOrganizations.map((organization: OrganizationSummary) => (
                <Link
                  key={organization.id}
                  href={`/admin/organizations/${organization.id}`}
                  className="grid gap-2 border-b px-4 py-4 transition-colors last:border-0 hover:bg-muted/40 md:grid-cols-[1.5fr_.6fr_.7fr_1fr_.8fr_auto] md:items-center md:gap-3"
                >
                  <span className="font-medium">{organization.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {organization.code}
                  </span>
                  <span>
                    <Badge className={ORGANIZATION_STATUS_CLASS[organization.status]}>
                      {organizationStatusLabel(organization.status)}
                    </Badge>
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {organization.primary_admin_name ||
                      organization.primary_admin_email ||
                      "No primary admin"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {organization.office_count} office
                    {organization.office_count === 1 ? "" : "s"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatRelativeDate(organization.updated_at)}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Building2Icon className="size-10 text-muted-foreground" />
              <div>
                <p className="font-medium">No organizations yet</p>
                <p className="text-sm text-muted-foreground">
                  Create the first government tenant to populate the dashboard.
                </p>
              </div>
              <Button render={<Link href="/admin/organizations/new" />}>
                <PlusIcon /> Create organization
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    under_review: "Under review",
    in_evaluation: "Under review",
    recommended: "For approval",
    in_approval: "For approval",
    approved: "Approved",
    claimed: "Claimed",
    disbursed: "Disbursed",
    declined: "Declined",
    rejected: "Declined",
    cancelled: "Cancelled",
  }
  return map[status] ?? status
}

function activityDetail(
  app: NestDashboardSummary["recent_applications"][number],
) {
  const who = app.customer_name ?? "Beneficiary"
  const program = app.template_name ?? "program"
  const place = app.municipality ? ` (${app.municipality})` : ""
  switch (app.status) {
    case "submitted":
      return `${app.reference_no} filed for ${program}${place}`
    case "under_review":
      return `${app.reference_no} under review — ${who}`
    case "recommended":
      return `${app.reference_no} endorsed to approver queue`
    case "approved":
      return `${app.reference_no} approved for disbursement`
    case "claimed":
    case "disbursed":
      return `${app.reference_no} claim completed — ${who}`
    case "declined":
      return `${app.reference_no} declined`
    default:
      return `${app.reference_no} · ${statusLabel(app.status)} — ${who}`
  }
}

function OrgOfficeDashboard() {
  const { profile } = useAdminAccess()
  const [summary, setSummary] = React.useState<NestDashboardSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await nestFetch<NestDashboardSummary>(
        "/admin/dashboard-summary",
      )
      setSummary(data)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load dashboard",
      )
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const roleLabel = profile
    ? (APP_ROLE_LABEL[profile.role] ?? profile.role)
    : "Admin"
  const signedIn =
    profile?.fullName?.trim() || profile?.email || roleLabel

  const pipeline = summary?.pipeline
  const total = summary?.total_applications ?? 0
  const locations = summary?.by_location ?? []
  const maxLocation = Math.max(1, ...locations.map((l) => l.count))

  const kpis = [
    {
      label: "Total Applications",
      value: summary?.total_applications ?? 0,
      icon: FolderOpenIcon,
      hint:
        summary?.scope === "office"
          ? "this office, all programs"
          : "organization-wide, all programs",
    },
    {
      label: "Awaiting Approval",
      value: summary?.awaiting_approval ?? 0,
      icon: HourglassIcon,
      hint: "in approver queues",
    },
    {
      label: "Registered Customers",
      value: summary?.registered_customers ?? 0,
      icon: UsersIcon,
      hint: `${summary?.face_verified_customers ?? 0} face-verified`,
    },
    {
      label: "Claimed",
      value: summary?.claimed_or_disbursed ?? 0,
      icon: WalletIcon,
      hint: "cash-window releases completed",
    },
  ]

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Signed in as ${signedIn}${profile?.fullName ? ` (${roleLabel})` : ""}.`}
      />

      {error ? (
        <Card className="border-destructive">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="text-sm">
              {error}
            </p>
            <Button variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid auto-rows-min gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-xl" />
            ))
          : kpis.map((k) => {
              const Icon = k.icon
              return (
                <Card key={k.label}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                    <CardDescription>{k.label}</CardDescription>
                    <div className="flex size-8 items-center justify-center rounded-lg bg-[#0040E7]/10 text-[#0040E7]">
                      <Icon className="size-4" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <div className="text-2xl font-semibold tabular-nums">
                      {k.value}
                    </div>
                    <div className="text-xs text-muted-foreground">{k.hint}</div>
                  </CardContent>
                </Card>
              )
            })}
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline by Stage</CardTitle>
            <CardDescription>
              Live application lifecycle — Submitted → Review → Approval → Claim
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading || !pipeline ? (
              <>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </>
            ) : (
              PIPELINE_STAGES.map(({ key, label }) => {
                const count = pipeline[key] ?? 0
                const pct = total ? (count / total) * 100 : 0
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-28 shrink-0">
                      <StatusPill value={label} />
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-[#0040E7]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-6 text-right text-sm tabular-nums">
                      {count}
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Location</CardTitle>
            <CardDescription>
              Applications grouped by beneficiary municipality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </>
            ) : locations.length ? (
              locations.map((row) => (
                <div key={row.location} className="flex items-center gap-3">
                  <div
                    className="w-28 shrink-0 truncate text-sm"
                    title={row.location}
                  >
                    {row.location}
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#FCD116]"
                      style={{
                        width: `${(row.count / maxLocation) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="w-6 text-right text-sm tabular-nums">
                    {row.count}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No applications in scope yet.
              </p>
            )}
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Profile changes pending: {summary?.pending_profile_changes ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest application updates in your scope
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/admin/applications" />}
          >
            View all <ArrowRightIcon />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </>
          ) : summary?.recent_applications.length ? (
            summary.recent_applications.slice(0, 5).map((app) => (
              <Link
                key={app.id}
                href={`/admin/applications/${app.id}`}
                className="flex items-baseline gap-3 rounded-md px-1 py-1.5 text-sm hover:bg-muted/40"
              >
                <span className="w-40 shrink-0 font-mono text-xs text-muted-foreground">
                  {new Date(app.updated_at).toLocaleString()}
                </span>
                <span className="w-40 shrink-0 truncate text-muted-foreground">
                  {app.customer_name ?? "—"}
                </span>
                <span className="font-mono text-xs">{app.status}</span>
                <span className="truncate text-muted-foreground">
                  {activityDetail(app)}
                </span>
              </Link>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No recent application activity.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

export default function OverviewPage() {
  const { isPlatformAdmin } = useAdminAccess()

  if (isPlatformAdmin) {
    return <PlatformDashboard />
  }

  return <OrgOfficeDashboard />
}
