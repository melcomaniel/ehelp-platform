"use client"

import * as React from "react"
import Link from "next/link"

import { useAdminAccess } from "@/lib/admin/access-provider"
import {
  listOrganizations,
  organizationStatusLabel,
  type OrganizationPage,
  type OrganizationStatus,
} from "@/lib/admin/organizations"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Building2Icon, PlusIcon, SearchIcon } from "lucide-react"

const BADGE_CLASS: Record<OrganizationStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  suspended: "bg-amber-100 text-amber-800",
  archived: "bg-slate-200 text-slate-700",
}

export default function OrganizationsPage() {
  const { isPlatformAdmin, loading: accessLoading } = useAdminAccess()
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [result, setResult] = React.useState<OrganizationPage | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!isPlatformAdmin) return
    setLoading(true)
    setError(null)
    try {
      setResult(await listOrganizations({ search, status, page }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load organizations")
    } finally {
      setLoading(false)
    }
  }, [isPlatformAdmin, page, search, status])

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
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Manage government tenants and their initial Organization Administrators.
          </p>
        </div>
        <Button render={<Link href="/admin/organizations/new" />}>
          <PlusIcon /> Create organization
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            className="grid gap-4 md:grid-cols-[1fr_220px_auto]"
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
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
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
            <Button className="self-end" type="submit" variant="outline">
              <SearchIcon /> Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive">
          <CardContent className="flex items-center justify-between pt-6">
            <p role="alert">{error}</p>
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
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Building2Icon className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No organizations found</p>
              <p className="text-sm text-muted-foreground">
                Adjust the filters or create the first organization.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border">
            <div className="hidden grid-cols-[1.5fr_.7fr_.7fr_1.2fr_.5fr_.8fr] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium uppercase text-muted-foreground md:grid">
              <span>Organization</span><span>Code</span><span>Status</span>
              <span>Primary admin</span><span>Offices</span><span>Updated</span>
            </div>
            {result.data.map((organization) => (
              <Link
                key={organization.id}
                href={`/admin/organizations/${organization.id}`}
                className="grid gap-2 border-b px-4 py-4 transition-colors last:border-0 hover:bg-muted/40 md:grid-cols-[1.5fr_.7fr_.7fr_1.2fr_.5fr_.8fr] md:items-center md:gap-3"
              >
                <span className="font-medium">{organization.name}</span>
                <span className="text-sm">{organization.code}</span>
                <span>
                  <Badge className={BADGE_CLASS[organization.status]}>
                    {organizationStatusLabel(organization.status)}
                  </Badge>
                </span>
                <span className="text-sm text-muted-foreground">
                  {organization.primary_admin_name || organization.primary_admin_email || "—"}
                </span>
                <span className="text-sm">{organization.office_count}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(organization.updated_at).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {result.pagination.total} organization{result.pagination.total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={page >= result.pagination.total_pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
