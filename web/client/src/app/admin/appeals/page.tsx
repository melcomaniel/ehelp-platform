"use client";

import * as React from "react";

import { nestFetch } from "@/lib/api/nest";
import { DataTable, PageHeader, Td } from "@/components/ehelp/bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ReportsResponse = {
  source: string;
  region_code: string;
  meta?: {
    total?: number;
    per_page?: number;
    current_page?: number;
    total_pages?: number;
  };
  data: Array<{
    type?: string;
    id?: string;
    attributes?: {
      case_number?: string;
      subject?: string;
      message?: string;
      report_type?: { code?: string; name?: string } | string;
      region_code?: string;
      created_at?: string;
      mode?: string;
      complainant?: { first_name?: string; last_name?: string };
    };
    case_number?: string;
    subject?: string;
    category_code?: string;
  }>;
};

function rowFields(item: ReportsResponse["data"][number]) {
  const a = item.attributes ?? item;
  const caseNumber =
    a.case_number ?? item.id ?? (item as { case_number?: string }).case_number ?? "—";
  const subject = a.subject ?? "—";
  const reportType =
    typeof a.report_type === "string"
      ? a.report_type
      : a.report_type?.name ?? a.report_type?.code ?? (item as { category_code?: string }).category_code ?? "—";
  const complainant = a.complainant
    ? [a.complainant.first_name, a.complainant.last_name].filter(Boolean).join(" ")
    : "—";
  const created = a.created_at
    ? new Date(a.created_at).toLocaleString()
    : "—";
  return { caseNumber, subject, reportType, complainant, created, mode: a.mode };
}

export default function AppealsEreportPage() {
  const [region, setRegion] = React.useState("NCR");
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [payload, setPayload] = React.useState<ReportsResponse | null>(null);
  const [otpEmail, setOtpEmail] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [otpMsg, setOtpMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("region", region.trim() || "NCR");
      if (q.trim()) params.set("q", q.trim());
      const data = await nestFetch<ReportsResponse>(
        `/admin/ereport/reports?${params.toString()}`,
      );
      setPayload(data);
    } catch (e) {
      setPayload(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [region, q]);

  React.useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function requestOtp() {
    setOtpMsg(null);
    try {
      const res = await nestFetch<{ message?: string }>(
        "/admin/ereport/view-token/request",
        { method: "POST", body: { email: otpEmail.trim() } },
      );
      setOtpMsg(res.message ?? "OTP requested");
    } catch (e) {
      setOtpMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function confirmOtp() {
    setOtpMsg(null);
    try {
      await nestFetch("/admin/ereport/view-token/confirm", {
        method: "POST",
        body: { email: otpEmail.trim(), otp: otp.trim() },
      });
      setOtpMsg("View token saved for this Nest process. Refresh the list.");
      await load();
    } catch (e) {
      setOtpMsg(e instanceof Error ? e.message : String(e));
    }
  }

  const rows = payload?.data ?? [];

  return (
    <>
      <PageHeader
        title="Appeals (eReport)"
        description="Organization Admin view of citizen eReports, filtered to your region (default NCR)."
      >
        <Button size="sm" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </PageHeader>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="NCR or 130000000"
              className="w-48"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="q">Search</Label>
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Case no. or subject"
              className="w-64"
            />
          </div>
          <Button onClick={() => void load()}>Search</Button>
          {payload && (
            <p className="text-sm text-muted-foreground">
              Source: {payload.source} · region {payload.region_code} ·{" "}
              {payload.meta?.total ?? rows.length} total
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Upstream view token (optional)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="otp-email">Ops email</Label>
            <Input
              id="otp-email"
              type="email"
              value={otpEmail}
              onChange={(e) => setOtpEmail(e.target.value)}
              className="w-64"
            />
          </div>
          <Button variant="outline" onClick={() => void requestOtp()}>
            Request OTP
          </Button>
          <div className="grid gap-1.5">
            <Label htmlFor="otp">OTP</Label>
            <Input
              id="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-36"
            />
          </div>
          <Button variant="outline" onClick={() => void confirmOtp()}>
            Confirm OTP
          </Button>
          {otpMsg && (
            <p className="w-full text-sm text-muted-foreground">{otpMsg}</p>
          )}
        </CardContent>
      </Card>

      {error && (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <DataTable
        headers={[
          "Case no.",
          "Type",
          "Complainant",
          "Subject",
          "Submitted",
          "Source",
        ]}
      >
        {loading ? (
          <tr>
            <Td colSpan={6}>Loading…</Td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <Td colSpan={6}>
              No reports for this region yet. Beneficiary submissions appear
              here (local ledger) even without an upstream view token.
            </Td>
          </tr>
        ) : (
          rows.map((item, i) => {
            const f = rowFields(item);
            return (
              <tr key={`${f.caseNumber}-${i}`}>
                <Td className="font-mono text-xs">{f.caseNumber}</Td>
                <Td>{f.reportType}</Td>
                <Td>{f.complainant}</Td>
                <Td>{f.subject}</Td>
                <Td>{f.created}</Td>
                <Td>{f.mode ?? payload?.source ?? "—"}</Td>
              </tr>
            );
          })
        )}
      </DataTable>
    </>
  );
}
