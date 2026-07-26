"use client";

import * as React from "react";
import Link from "next/link";

import { DataTable, Td } from "@/components/ehelp/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminAccess } from "@/lib/admin/access-provider";
import {
  listOrganizationAdmins,
  organizationStatusLabel,
  type OrganizationAdminPage,
  type OrganizationStatus,
} from "@/lib/admin/organizations";
import { SearchIcon } from "lucide-react";

const ORG_STATUS_CLASS: Record<OrganizationStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  suspended: "bg-amber-100 text-amber-800",
  archived: "bg-slate-200 text-slate-700",
};

function accountStatusLabel(status: string, active: boolean) {
  if (!active) return "Suspended";
  return status[0]?.toUpperCase() + status.slice(1);
}

export default function OrganizationAdminsPage() {
  const { isPlatformAdmin, loading: accessLoading } = useAdminAccess();
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [invitationStatus, setInvitationStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [result, setResult] = React.useState<OrganizationAdminPage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!isPlatformAdmin) return;
    setLoading(true);
    setError(null);
    try {
      setResult(
        await listOrganizationAdmins({
          search,
          status,
          invitationStatus,
          page,
          pageSize: 20,
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load Organization Admins",
      );
    } finally {
      setLoading(false);
    }
  }, [invitationStatus, isPlatformAdmin, page, search, status]);

  React.useEffect(() => {
    if (!accessLoading) {
      const timer = window.setTimeout(() => void load(), 0);
      return () => window.clearTimeout(timer);
    }
  }, [accessLoading, load]);

  if (accessLoading) return <Skeleton className="h-72 w-full" />;
  if (!isPlatformAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Forbidden</CardTitle>
        </CardHeader>
        <CardContent>Platform Administrator access is required.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Organization Admins</h1>
        <p className="text-sm text-muted-foreground">
          Search and review tenant administrator accounts across organizations.
        </p>
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
              <Label htmlFor="org-admin-search">Search</Label>
              <Input
                id="org-admin-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Name, email, organization, or code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-admin-status">Account status</Label>
              <select
                id="org-admin-status"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={status}
                onChange={(event) => {
                  setPage(1);
                  setStatus(event.target.value);
                }}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-admin-invitation">Invitation</Label>
              <select
                id="org-admin-invitation"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={invitationStatus}
                onChange={(event) => {
                  setPage(1);
                  setInvitationStatus(event.target.value);
                }}
              >
                <option value="">All invitations</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="revoked">Revoked</option>
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
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <p className="text-sm" role="alert">
              {error}
            </p>
            <Button variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3" aria-label="Loading Organization Admins">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Directory</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DataTable
              headers={[
                "Name",
                "Email",
                "Organization",
                "Org status",
                "Account",
                "Invitation",
                "Created",
                "",
              ]}
              empty={!result?.data.length}
            >
              {(result?.data ?? []).map((admin) => (
                <tr key={admin.id} className="border-b last:border-0">
                  <Td className="font-medium">{admin.full_name}</Td>
                  <Td className="text-muted-foreground">{admin.email}</Td>
                  <Td>
                    <div className="grid gap-0.5">
                      <span>{admin.organization_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {admin.organization_code}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <Badge className={ORG_STATUS_CLASS[admin.organization_status]}>
                      {organizationStatusLabel(admin.organization_status)}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge variant={admin.is_active ? "secondary" : "destructive"}>
                      {accountStatusLabel(admin.status, admin.is_active)}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground">
                    {admin.invitation_status ?? "—"}
                  </Td>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {new Date(admin.created_at).toLocaleDateString()}
                  </Td>
                  <Td className="text-right">
                    <Button
                      size="xs"
                      variant="outline"
                      render={
                        <Link href={`/admin/organizations/${admin.organization_id}`} />
                      }
                    >
                      Open
                    </Button>
                  </Td>
                </tr>
              ))}
            </DataTable>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {result?.pagination.total ?? 0} Organization Admin
                {(result?.pagination.total ?? 0) === 1 ? "" : "s"} · Page{" "}
                {result?.pagination.page ?? page} of{" "}
                {result?.pagination.total_pages ?? 1}
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
                  disabled={!result || page >= result.pagination.total_pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
