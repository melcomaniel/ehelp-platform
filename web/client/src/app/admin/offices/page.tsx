"use client";

import * as React from "react";
import Link from "next/link";

import { useAdminAccess } from "@/lib/admin/access-provider";
import {
  OFFICE_LEVEL_LABEL,
  listOffices,
  officeStatusLabel,
  type OfficeLevel,
  type OfficePage,
  type OfficeStatus,
} from "@/lib/admin/offices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { LandmarkIcon, PlusIcon, SearchIcon } from "lucide-react";

const BADGE_CLASS: Record<OfficeStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  archived: "bg-slate-200 text-slate-700",
};

export default function OfficesPage() {
  const { profile, loading: accessLoading } = useAdminAccess();
  const isOrgAdmin = profile?.role === "dswd_admin";
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState<OfficePage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!isOrgAdmin) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await listOffices({ search, status, level, page }));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load offices",
      );
    } finally {
      setLoading(false);
    }
  }, [isOrgAdmin, level, page, search, status]);

  React.useEffect(() => {
    if (!accessLoading) {
      const timer = window.setTimeout(() => void load(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [accessLoading, load]);

  if (accessLoading) return <Skeleton className="h-72 w-full" />;
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

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Offices</h1>
          <p className="text-sm text-muted-foreground">
            Manage office records for{" "}
            {result?.organization.name ?? "your organization"}.
          </p>
        </div>
        <Button render={<Link href="/admin/offices/new" />}>
          <PlusIcon /> Add office
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            className="grid gap-4 lg:grid-cols-[1fr_190px_190px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="office-search">Search</Label>
              <Input
                id="office-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name or code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="office-level">Office type</Label>
              <select
                id="office-level"
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={level}
                onChange={(event) => {
                  setPage(1);
                  setLevel(event.target.value);
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
            <div className="space-y-2">
              <Label htmlFor="office-status">Status</Label>
              <select
                id="office-status"
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={status}
                onChange={(event) => {
                  setPage(1);
                  setStatus(event.target.value);
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
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-destructive">
          <CardContent className="flex items-center justify-between pt-6">
            <p role="alert">{error}</p>
            <Button variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3" aria-label="Loading offices">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !result?.data.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <LandmarkIcon className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No offices found</p>
              <p className="text-sm text-muted-foreground">
                Add the first office or adjust the filters.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border">
            <div className="hidden grid-cols-[1.4fr_.7fr_.8fr_1fr_.5fr_.7fr] gap-3 border-b bg-muted/50 px-4 py-3 text-xs font-medium uppercase text-muted-foreground md:grid">
              <span>Office</span>
              <span>Code</span>
              <span>Type</span>
              <span>Parent</span>
              <span>Children</span>
              <span>Status</span>
            </div>
            {result.data.map((office) => (
              <Link
                key={office.id}
                href={`/admin/offices/${office.id}`}
                className="grid gap-2 border-b px-4 py-4 transition-colors last:border-0 hover:bg-muted/40 md:grid-cols-[1.4fr_.7fr_.8fr_1fr_.5fr_.7fr] md:items-center md:gap-3"
              >
                <span className="font-medium">{office.name}</span>
                <span className="text-sm">{office.code}</span>
                <span className="text-sm">
                  {OFFICE_LEVEL_LABEL[office.level as OfficeLevel]}
                </span>
                <span className="text-sm text-muted-foreground">
                  {office.parent_office_name ?? "None"}
                </span>
                <span className="text-sm">{office.direct_child_count}</span>
                <span>
                  <Badge className={BADGE_CLASS[office.status]}>
                    {officeStatusLabel(office.status)}
                  </Badge>
                </span>
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {result.pagination.total} office
              {result.pagination.total === 1 ? "" : "s"}
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
  );
}
