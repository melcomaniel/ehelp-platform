"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { nestFetch, type NestApplication } from "@/lib/api/nest";
import { DataTable, PageHeader, StatusPill, Td } from "@/components/ehelp/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchIcon, XIcon } from "lucide-react";

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "recommended", label: "For approval" },
  { value: "approved", label: "Approved" },
  { value: "claimed", label: "Claimed" },
  { value: "disbursed", label: "Disbursed" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
] as const;

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
  };
  return map[status] ?? status;
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [apps, setApps] = React.useState<NestApplication[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = status
        ? `/applications/queue?statuses=${encodeURIComponent(status)}`
        : "/applications/queue";
      const list = await nestFetch<NestApplication[]>(q);
      setApps(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setApps([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  React.useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const rows = apps.filter((a) => {
    const term = search.toLowerCase();
    if (!term) return true;
    return [
      a.reference_no,
      a.customer_name,
      a.template_name,
      a.template_code,
      a.status,
      a.customer_municipality,
      a.customer_phone,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
  });

  return (
    <>
      <PageHeader
        title="Applications"
        description="Office cases from the live queue — including claimed / completed disbursements."
      >
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </PageHeader>

      <Card>
        <CardContent>
          <form
            className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_220px_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput.trim());
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="application-search">Search</Label>
              <Input
                id="application-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Case no., customer, program"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="application-status">Status</Label>
              <select
                id="application-status"
                className="min-h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {STATUS_FILTERS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Button className="self-end" type="submit" variant="outline">
              <SearchIcon /> Search
            </Button>
            <Button
              className="self-end"
              type="button"
              variant="ghost"
              onClick={() => {
                setSearchInput("");
                setSearch("");
                setStatus("");
              }}
            >
              <XIcon /> Clear
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {error ? (
            <p className="py-6 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">Loading cases…</p>
          ) : (
            <DataTable
              headers={[
                "Case No.",
                "Customer",
                "Program",
                "Location",
                "Submitted",
                "Status",
              ]}
              empty={rows.length === 0}
            >
              {rows.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/40 focus-within:bg-muted/40"
                  tabIndex={0}
                  role="link"
                  onClick={() => router.push(`/admin/applications/${a.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/admin/applications/${a.id}`);
                    }
                  }}
                >
                  <Td className="font-mono text-xs">{a.reference_no}</Td>
                  <Td>{a.customer_name || "—"}</Td>
                  <Td className="text-muted-foreground">
                    {a.template_name || a.template_code || "—"}
                  </Td>
                  <Td className="text-muted-foreground">
                    {a.customer_municipality || a.customer_barangay || "—"}
                  </Td>
                  <Td className="text-muted-foreground">
                    {a.submitted_at
                      ? new Date(a.submitted_at).toLocaleDateString()
                      : "—"}
                  </Td>
                  <Td>
                    <StatusPill value={statusLabel(a.status)} />
                  </Td>
                </tr>
              ))}
            </DataTable>
          )}
        </CardContent>
      </Card>
    </>
  );
}
