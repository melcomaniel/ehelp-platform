"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { useAdminAccess } from "@/lib/admin/access-provider"
import {
  listOrganizations,
  organizationStatusLabel,
  type OrganizationPage,
  type OrganizationStatus,
} from "@/lib/admin/organizations"
import { EmptyState, PageHeader } from "@/components/ehelp/bits"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Building2Icon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon } from "lucide-react"

const BADGE_CLASS: Record<OrganizationStatus, string> = {
  active: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  suspended: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  archived: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
}

export default function OrganizationsPage() {
  const router = useRouter()
  const { isPlatformAdmin, loading: accessLoading } = useAdminAccess()
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [includeArchived, setIncludeArchived] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [result, setResult] = React.useState<OrganizationPage | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!isPlatformAdmin) return
    setLoading(true)
    setError(null)
    try {
      setResult(
        await listOrganizations({ search, status, includeArchived, page }),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load organizations")
    } finally {
      setLoading(false)
    }
  }, [includeArchived, isPlatformAdmin, page, search, status])

  React.useEffect(() => {
    if (!accessLoading) {
      const timer = window.setTimeout(() => void load(), 0)
      return () => window.clearTimeout(timer)
    }
  }, [accessLoading, load])

  if (accessLoading) {
    return <Skeleton className="h-72 w-full" />
  }
  if (!isPlatformAdmin) {
    return (
      <Card>
        <CardHeader><CardTitle>Forbidden</CardTitle></CardHeader>
        <CardContent>Platform Administrator access is required.</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organizations"
        description="Manage government tenants and their initial Organization Administrators."
      >
        <Button render={<Link href="/admin/organizations/new" />}>
          <PlusIcon /> Create organization
        </Button>
      </PageHeader>

      <Card>
        <CardContent>
          <form
            className="grid gap-4 lg:grid-cols-[minmax(14rem,1fr)_220px_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              setPage(1)
              setSearch(searchInput.trim())
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="organization-search">Search</Label>
              <Input
                id="organization-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name or code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization-status">Status</Label>
              <select
                id="organization-status"
                className="min-h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45"
                value={status}
                onChange={(event) => {
                  setPage(1)
                  setStatus(event.target.value)
                }}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <label className="flex min-h-10 items-center gap-2 self-end rounded-lg px-1 text-sm focus-within:ring-3 focus-within:ring-ring/45">
              <input
                type="checkbox"
                className="size-4 rounded border-input accent-[var(--gov-blue)]"
                checked={includeArchived}
                onChange={(event) => {
                  setPage(1)
                  setIncludeArchived(event.target.checked)
                }}
              />
              Include archived
            </label>
            <Button className="self-end" type="submit" variant="outline">
              <SearchIcon /> Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p role="alert" className="text-sm">
              We could not load organizations. Please try again.
            </p>
            <Button variant="outline" onClick={() => void load()}>Retry</Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3" aria-label="Loading organizations">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !result?.data.length ? (
        <Card>
          <CardContent>
            <EmptyState
              title="No organizations found"
              description="Adjust the filters or create the first organization."
              icon={<Building2Icon className="size-5" aria-hidden />}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-blue-100 bg-card shadow-[var(--shadow-soft)]">
            <table className="w-full min-w-[58rem] text-sm">
              <caption className="sr-only">
                Government organizations matching the selected filters
              </caption>
              <thead>
                <tr className="border-b border-blue-100 bg-secondary text-left text-xs font-semibold uppercase text-secondary-foreground">
                  <th scope="col" className="px-4 py-3">Organization</th>
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Primary admin</th>
                  <th scope="col" className="px-4 py-3">Offices</th>
                  <th scope="col" className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((organization) => (
                  <tr
                    key={organization.id}
                    className="cursor-pointer border-b border-blue-50 last:border-0 hover:bg-blue-50/55 focus-within:bg-blue-50/55"
                    tabIndex={0}
                    role="link"
                    onClick={() => router.push(`/admin/organizations/${organization.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        router.push(`/admin/organizations/${organization.id}`)
                      }
                    }}
                  >
                    <th scope="row" className="px-4 py-4 text-left font-semibold">
                      <Link
                        href={`/admin/organizations/${organization.id}`}
                        className="rounded-md text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/45"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {organization.name}
                      </Link>
                    </th>
                    <td className="px-4 py-4">{organization.code}</td>
                    <td className="px-4 py-4">
                      <Badge className={BADGE_CLASS[organization.status]}>
                        {organizationStatusLabel(organization.status)}
                      </Badge>
                    </td>
                    <td className="max-w-64 px-4 py-4 text-muted-foreground">
                      <span className="block truncate">
                        {organization.primary_admin_name || organization.primary_admin_email || "No primary admin"}
                      </span>
                    </td>
                    <td className="px-4 py-4 tabular-nums">
                      {organization.office_count}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {new Date(organization.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {result.pagination.total_pages} · {result.pagination.total} organization{result.pagination.total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeftIcon /> Previous
              </Button>
              <Button
                variant="outline"
                disabled={page >= result.pagination.total_pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
