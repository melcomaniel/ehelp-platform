"use client"

import * as React from "react"

import { useAdminAccess } from "@/lib/admin/access-provider"
import {
  listProgramTemplates,
  listRegionTemplates,
  saveProgramTemplate,
  saveRegionTemplate,
  toggleProgramTemplate,
  type ProgramTemplateRow,
  type RegionTemplateRow,
} from "@/lib/admin/template-actions"
import {
  DataTable,
  Field,
  PageHeader,
  StatusPill,
  Td,
} from "@/components/ehelp/bits"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PencilIcon, PlusIcon } from "lucide-react"

function requirementsOf(t: ProgramTemplateRow) {
  const r = t.eligibilityRules?.requirements
  return typeof r === "string" ? r : ""
}

function noteOf(o: RegionTemplateRow) {
  const n = o.localEligibilityRules?.eligibility_note
  return typeof n === "string" ? n : ""
}

function cooldownOf(o: RegionTemplateRow) {
  const c = o.localEligibilityRules?.cooldown_days
  return typeof c === "number" ? c : undefined
}

export default function TemplatesPage() {
  const { can, region, loading: accessLoading } = useAdminAccess()
  const master = can("manage-templates")
  const customize = can("customize-templates")

  const [templates, setTemplates] = React.useState<ProgramTemplateRow[]>([])
  const [overrides, setOverrides] = React.useState<RegionTemplateRow[]>([])
  const [editing, setEditing] = React.useState<ProgramTemplateRow | null>(null)
  const [openEdit, setOpenEdit] = React.useState(false)
  const [tName, setTName] = React.useState("")
  const [tProgram, setTProgram] = React.useState("")
  const [tCooldown, setTCooldown] = React.useState("90")
  const [tReqs, setTReqs] = React.useState("")
  const [overrideFor, setOverrideFor] = React.useState<ProgramTemplateRow | null>(
    null,
  )
  const [oNote, setONote] = React.useState("")
  const [oCooldown, setOCooldown] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    const [tpl, ov] = await Promise.all([
      listProgramTemplates(),
      listRegionTemplates(region?.id),
    ])
    setTemplates(tpl)
    setOverrides(ov)
  }, [region?.id])

  React.useEffect(() => {
    if (!accessLoading) void reload()
  }, [accessLoading, reload])

  const startEdit = (t: ProgramTemplateRow | null) => {
    setEditing(t)
    setTName(t?.name ?? "")
    setTProgram(t?.description ?? "")
    setTCooldown(String(t?.cooldownDays ?? 90))
    setTReqs(t ? requirementsOf(t) : "")
    setOpenEdit(true)
  }

  const submitTemplate = async () => {
    if (!tName) return
    setBusy(true)
    setMessage(null)
    const result = await saveProgramTemplate({
      id: editing?.id,
      name: tName,
      description: tProgram,
      requirements: tReqs,
      cooldownDays: Math.max(0, Number(tCooldown) || 0),
      isActive: editing?.isActive ?? true,
    })
    if (!result.ok) setMessage(result.error)
    else {
      setOpenEdit(false)
      await reload()
    }
    setBusy(false)
  }

  const startOverride = (t: ProgramTemplateRow) => {
    const existing = overrides.find((o) => o.templateId === t.id)
    setOverrideFor(t)
    setONote(existing ? noteOf(existing) : "")
    const cd = existing ? cooldownOf(existing) : undefined
    setOCooldown(cd !== undefined ? String(cd) : "")
  }

  const submitOverride = async () => {
    if (!overrideFor) return
    setBusy(true)
    setMessage(null)
    const result = await saveRegionTemplate({
      templateId: overrideFor.id,
      eligibilityNote: oNote,
      cooldownDays: oCooldown ? Math.max(0, Number(oCooldown) || 0) : undefined,
    })
    if (!result.ok) setMessage(result.error)
    else {
      setOverrideFor(null)
      await reload()
    }
    setBusy(false)
  }

  return (
    <>
      <PageHeader
        title="Templates"
        description={
          master
            ? "Master program templates — system-wide definitions and disbursement cooldowns"
            : `Regional customization for ${region?.name ?? "your region"} — master templates stay read-only`
        }
      >
        {master && (
          <Button size="sm" onClick={() => startEdit(null)}>
            <PlusIcon /> New template
          </Button>
        )}
      </PageHeader>

      {message && (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Master Templates</CardTitle>
          <CardDescription>
            Cooldown gates repeat disbursements per customer per program
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={[
              "Name",
              "Description",
              "Cooldown",
              "Requirements",
              "Status",
              "Actions",
            ]}
            empty={!accessLoading && templates.length === 0}
          >
            {templates.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <Td>{t.name}</Td>
                <Td className="text-muted-foreground">
                  {t.description || "—"}
                </Td>
                <Td className="tabular-nums">{t.cooldownDays} days</Td>
                <Td className="max-w-64 text-xs text-muted-foreground">
                  {requirementsOf(t) || "—"}
                </Td>
                <Td>
                  <StatusPill value={t.isActive ? "Active" : "Pending"} />
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {master && (
                      <>
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={busy}
                          onClick={() => startEdit(t)}
                        >
                          <PencilIcon /> Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            void toggleProgramTemplate(t.id, !t.isActive).then(
                              (r) => {
                                if (!r.ok) setMessage(r.error)
                                else void reload()
                              },
                            )
                          }
                        >
                          {t.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </>
                    )}
                    {customize && (
                      <Button
                        size="xs"
                        disabled={busy}
                        onClick={() => startOverride(t)}
                      >
                        Customize for {region?.code ?? "region"}
                      </Button>
                    )}
                    {!master && !customize && (
                      <span className="text-xs text-muted-foreground">
                        read-only
                      </span>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regional Customizations</CardTitle>
          <CardDescription>
            Local eligibility notes and optional cooldown overrides
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={[
              "Template",
              "Region",
              "Eligibility Note",
              "Cooldown Override",
            ]}
            empty={overrides.length === 0}
          >
            {overrides.map((o) => {
              const tpl = templates.find((t) => t.id === o.templateId)
              const cd = cooldownOf(o)
              return (
                <tr key={o.id} className="border-b last:border-0">
                  <Td>{tpl?.name ?? o.templateId.slice(0, 8)}</Td>
                  <Td className="text-muted-foreground">
                    {o.regionCode ?? "—"}
                  </Td>
                  <Td className="text-muted-foreground">
                    {noteOf(o) || "—"}
                  </Td>
                  <Td className="tabular-nums">
                    {cd !== undefined ? `${cd} days` : "inherits master"}
                  </Td>
                </tr>
              )
            })}
          </DataTable>
        </CardContent>
      </Card>

      <Sheet open={openEdit} onOpenChange={setOpenEdit}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editing ? `Edit ${editing.name}` : "New master template"}
            </SheetTitle>
            <SheetDescription>
              System-wide — applies to every region unless overridden.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <Field
              label="Name"
              value={tName}
              onChange={(e) => setTName(e.target.value)}
            />
            <Field
              label="Description / program"
              value={tProgram}
              onChange={(e) => setTProgram(e.target.value)}
              placeholder="DSWD · AICS"
            />
            <Field
              label="Disbursement cooldown (days)"
              type="number"
              value={tCooldown}
              onChange={(e) => setTCooldown(e.target.value)}
            />
            <Field
              label="Requirements"
              value={tReqs}
              onChange={(e) => setTReqs(e.target.value)}
              placeholder="Valid ID, barangay certificate…"
            />
          </div>
          <SheetFooter>
            <Button
              onClick={() => void submitTemplate()}
              disabled={busy || !tName}
            >
              Save template
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!overrideFor}
        onOpenChange={(v) => !v && setOverrideFor(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Customize {overrideFor?.name}</SheetTitle>
            <SheetDescription>
              Applies to {region?.name ?? "your region"} only. Blank cooldown
              inherits the master value ({overrideFor?.cooldownDays} days).
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <Field
              label="Local eligibility note"
              value={oNote}
              onChange={(e) => setONote(e.target.value)}
              placeholder="Typhoon-affected barangays prioritized"
            />
            <Field
              label="Cooldown override (days, optional)"
              type="number"
              value={oCooldown}
              onChange={(e) => setOCooldown(e.target.value)}
            />
          </div>
          <SheetFooter>
            <Button disabled={busy} onClick={() => void submitOverride()}>
              Save customization
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
