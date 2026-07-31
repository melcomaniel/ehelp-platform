"use client";

import * as React from "react";
import Link from "next/link";

import { useAdminAccess } from "@/lib/admin/access-provider";
import {
  listProgramTemplates,
  saveProgramTemplate,
  toggleProgramTemplate,
  type ProgramTemplateRow,
} from "@/lib/admin/template-actions";
import {
  DataTable,
  Field,
  PageHeader,
  StatusPill,
  Td,
} from "@/components/ehelp/bits";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PencilIcon, PlusIcon } from "lucide-react";

function requirementsOf(t: ProgramTemplateRow) {
  const r = t.eligibilityRules?.requirements;
  return typeof r === "string" ? r : "";
}

function eligibilityOf(t: ProgramTemplateRow) {
  const e = t.eligibilityRules?.eligibility;
  if (!e || typeof e !== "object") {
    return { minAge: "", maxAge: "", regions: "NCR", municipalities: "" };
  }
  const o = e as Record<string, unknown>;
  return {
    minAge: o.min_age != null ? String(o.min_age) : "",
    maxAge: o.max_age != null ? String(o.max_age) : "",
    regions: Array.isArray(o.regions)
      ? (o.regions as string[]).join(", ")
      : typeof o.regions === "string"
        ? o.regions
        : "NCR",
    municipalities: Array.isArray(o.municipalities)
      ? (o.municipalities as string[]).join(", ")
      : typeof o.municipalities === "string"
        ? o.municipalities
        : "",
  };
}

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string) {
  if (!v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function ProgramsPage() {
  const { can, loading: accessLoading } = useAdminAccess();
  const master = can("manage-templates");
  const canEdit = master || can("customize-templates");

  const [programs, setPrograms] = React.useState<ProgramTemplateRow[]>([]);
  const [editing, setEditing] = React.useState<ProgramTemplateRow | null>(null);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [tName, setTName] = React.useState("");
  const [tDesc, setTDesc] = React.useState("");
  const [tCooldown, setTCooldown] = React.useState("90");
  const [tReqs, setTReqs] = React.useState("");
  const [tMinAge, setTMinAge] = React.useState("");
  const [tMaxAge, setTMaxAge] = React.useState("");
  const [tRegions, setTRegions] = React.useState("NCR");
  const [tMunicipalities, setTMunicipalities] = React.useState("");
  const [tApplyStart, setTApplyStart] = React.useState("");
  const [tApplyEnd, setTApplyEnd] = React.useState("");
  const [tReviewEnd, setTReviewEnd] = React.useState("");
  const [tDisburseStart, setTDisburseStart] = React.useState("");
  const [tDisburseEnd, setTDisburseEnd] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    const list = await listProgramTemplates();
    setPrograms(list);
  }, []);

  React.useEffect(() => {
    if (accessLoading) return;
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [accessLoading, reload]);

  const startEdit = (t: ProgramTemplateRow | null) => {
    setEditing(t);
    setTName(t?.name ?? "");
    setTDesc(t?.description ?? "");
    setTCooldown(String(t?.cooldownDays ?? 90));
    setTReqs(t ? requirementsOf(t) : "");
    const el = t ? eligibilityOf(t) : null;
    setTMinAge(el?.minAge ?? "");
    setTMaxAge(el?.maxAge ?? "");
    setTRegions(el?.regions ?? "NCR");
    setTMunicipalities(el?.municipalities ?? "");
    const p = t?.periodWindows;
    setTApplyStart(toLocalInput(p?.application_start));
    setTApplyEnd(toLocalInput(p?.application_end));
    setTReviewEnd(toLocalInput(p?.review_end));
    setTDisburseStart(toLocalInput(p?.disbursement_start));
    setTDisburseEnd(toLocalInput(p?.disbursement_end));
    setOpenEdit(true);
  };

  const submit = async () => {
    if (!tName.trim()) return;
    setBusy(true);
    setMessage(null);
    const result = await saveProgramTemplate({
      id: editing?.id,
      name: tName,
      description: tDesc,
      requirements: tReqs,
      cooldownDays: Math.max(0, Number(tCooldown) || 0),
      isActive: editing?.isActive ?? true,
      minAge: tMinAge ? Number(tMinAge) : undefined,
      maxAge: tMaxAge ? Number(tMaxAge) : undefined,
      regions: tRegions
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      municipalities: tMunicipalities
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      periodWindows: {
        application_start: fromLocalInput(tApplyStart),
        application_end: fromLocalInput(tApplyEnd),
        review_start: fromLocalInput(tApplyStart),
        review_end: fromLocalInput(tReviewEnd),
        review_leeway_days: 0,
        disbursement_start: fromLocalInput(tDisburseStart),
        disbursement_end: fromLocalInput(tDisburseEnd),
      },
    });
    if (!result.ok) setMessage(result.error);
    else {
      setOpenEdit(false);
      await reload();
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader
        title="Programs"
        description="Assistance programs for your organization — cooldown, age, and location rules control who sees them on mobile."
      >
        {master && (
          <Button size="sm" onClick={() => startEdit(null)}>
            <PlusIcon /> Create Program
          </Button>
        )}
      </PageHeader>

      {message && (
        <p className="text-sm text-destructive" role="status">
          {message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All programs</CardTitle>
          <CardDescription>
            Published programs appear in the mobile app when the beneficiary
            matches age and location rules (e.g. NCR / Quezon City).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={[
              "Name",
              "Cooldown (days)",
              "Eligibility",
              "Status",
              "Actions",
            ]}
            empty={programs.length === 0}
            emptyText="No programs yet — create one to publish to mobile."
          >
            {programs.map((p) => {
              const el = eligibilityOf(p);
              return (
                <tr key={p.id} className="border-b last:border-0">
                  <Td className="font-medium">{p.name}</Td>
                  <Td className="tabular-nums">{p.cooldownDays}</Td>
                  <Td className="text-xs text-muted-foreground">
                    {[
                      el.minAge || el.maxAge
                        ? `Age ${el.minAge || "—"}–${el.maxAge || "—"}`
                        : null,
                      el.regions || null,
                      el.municipalities || null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Open"}
                  </Td>
                  <Td>
                    <StatusPill
                      value={p.isActive ? "published" : "draft"}
                    />
                  </Td>
                  <Td>
                    <div className="flex gap-2">
                      {canEdit && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => startEdit(p)}
                        >
                          <PencilIcon /> Edit
                        </Button>
                      )}
                      {master && (
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            await toggleProgramTemplate(p.id, !p.isActive);
                            await reload();
                            setBusy(false);
                          }}
                        >
                          {p.isActive ? "Unpublish" : "Publish"}
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="ghost"
                        render={<Link href={`/admin/programs/${p.id}`} />}
                      >
                        Workflow
                      </Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </DataTable>
        </CardContent>
      </Card>

      <Sheet open={openEdit} onOpenChange={setOpenEdit}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editing ? "Edit program" : "Create program"}
            </SheetTitle>
            <SheetDescription>
              Set eligibility and the apply / review / disbursement time
              windows used by mobile and staff queues.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-3 px-4 py-2">
            <Field
              label="Name"
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              placeholder="AICS — Crisis Assistance"
            />
            <Field
              label="Description"
              value={tDesc}
              onChange={(e) => setTDesc(e.target.value)}
            />
            <Field
              label="Disbursement cooldown (days)"
              type="number"
              value={tCooldown}
              onChange={(e) => setTCooldown(e.target.value)}
            />
            <Field
              label="Requirements (plain text)"
              value={tReqs}
              onChange={(e) => setTReqs(e.target.value)}
              placeholder="Valid ID, proof of residency…"
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Min age"
                type="number"
                value={tMinAge}
                onChange={(e) => setTMinAge(e.target.value)}
                placeholder="18"
              />
              <Field
                label="Max age"
                type="number"
                value={tMaxAge}
                onChange={(e) => setTMaxAge(e.target.value)}
                placeholder="59"
              />
            </div>
            <Field
              label="Regions (comma-separated)"
              value={tRegions}
              onChange={(e) => setTRegions(e.target.value)}
              placeholder="NCR"
            />
            <Field
              label="Municipalities / cities (comma-separated)"
              value={tMunicipalities}
              onChange={(e) => setTMunicipalities(e.target.value)}
              placeholder="QUEZON CITY, MANILA"
            />
            <div className="rounded-md border p-3 space-y-3">
              <p className="text-sm font-medium">Program periods</p>
              <p className="text-xs text-muted-foreground">
                Evaluators and approvers can act as soon as applications open —
                there is no separate review wait or leeway. Beneficiaries book
                disbursement only inside the disbursement window (also used by
                Disbursement schedule when this program is selected).
              </p>
              <Field
                label="Application opens"
                type="datetime-local"
                value={tApplyStart}
                onChange={(e) => setTApplyStart(e.target.value)}
              />
              <Field
                label="Application closes"
                type="datetime-local"
                value={tApplyEnd}
                onChange={(e) => setTApplyEnd(e.target.value)}
              />
              <Field
                label="Review / approval hard close (optional)"
                type="datetime-local"
                value={tReviewEnd}
                onChange={(e) => setTReviewEnd(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to end review when applications close. Set only if
                staff must stop deciding after a specific time.
              </p>
              <Field
                label="Disbursement scheduling opens"
                type="datetime-local"
                value={tDisburseStart}
                onChange={(e) => setTDisburseStart(e.target.value)}
              />
              <Field
                label="Disbursement scheduling closes"
                type="datetime-local"
                value={tDisburseEnd}
                onChange={(e) => setTDisburseEnd(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Required for office queue slots. Open{" "}
                <Link
                  href="/admin/disbursement-slots"
                  className="underline underline-offset-2"
                >
                  Disbursement schedule
                </Link>{" "}
                and select this program to create calendar slots inside this
                window.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              After save, open <strong>Workflow</strong> on the program to
              connect Form → Verify → Review → Disbursement from Workflows.
            </p>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpenEdit(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !tName.trim()} onClick={() => void submit()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
