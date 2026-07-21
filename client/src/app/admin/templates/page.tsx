"use client"

import * as React from "react"

import { useEhelp } from "@/lib/ehelp/store"
import type { Template } from "@/lib/ehelp/types"
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

export default function TemplatesPage() {
  const { state, can, saveTemplate, saveOverride } = useEhelp()
  const { region } = state.session
  const master = can("manage-templates")
  const customize = can("customize-templates")

  const [editing, setEditing] = React.useState<Template | null>(null)
  const [openEdit, setOpenEdit] = React.useState(false)
  const [tName, setTName] = React.useState("")
  const [tProgram, setTProgram] = React.useState("")
  const [tCooldown, setTCooldown] = React.useState("90")
  const [tReqs, setTReqs] = React.useState("")

  const [overrideFor, setOverrideFor] = React.useState<Template | null>(null)
  const [oNote, setONote] = React.useState("")
  const [oCooldown, setOCooldown] = React.useState("")

  const startEdit = (t: Template | null) => {
    setEditing(t)
    setTName(t?.name ?? "")
    setTProgram(t?.program ?? "")
    setTCooldown(String(t?.cooldownDays ?? 90))
    setTReqs(t?.requirements ?? "")
    setOpenEdit(true)
  }

  const submitTemplate = () => {
    if (!tName || !tProgram) return
    saveTemplate({
      id: editing?.id ?? `TPL-${tName.replace(/[^A-Za-z]/g, "").slice(0, 8).toUpperCase()}`,
      name: tName,
      program: tProgram,
      cooldownDays: Math.max(0, Number(tCooldown) || 0),
      requirements: tReqs,
      active: editing?.active ?? true,
    })
    setOpenEdit(false)
  }

  const startOverride = (t: Template) => {
    const existing = state.overrides.find(
      (o) => o.templateId === t.id && o.region === region
    )
    setOverrideFor(t)
    setONote(existing?.eligibilityNote ?? "")
    setOCooldown(existing?.cooldownDays ? String(existing.cooldownDays) : "")
  }

  const submitOverride = () => {
    if (!overrideFor) return
    saveOverride({
      templateId: overrideFor.id,
      region,
      eligibilityNote: oNote,
      cooldownDays: oCooldown ? Math.max(0, Number(oCooldown) || 0) : undefined,
    })
    setOverrideFor(null)
  }

  return (
    <>
      <PageHeader
        title="Templates"
        description={
          master
            ? "Master program templates — system-wide definitions and disbursement cooldowns"
            : `Regional customization for ${region} — master templates stay read-only`
        }
      >
        {master && (
          <Button size="sm" onClick={() => startEdit(null)}>
            <PlusIcon /> New template
          </Button>
        )}
      </PageHeader>

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
              "ID",
              "Name",
              "Program",
              "Cooldown",
              "Requirements",
              "Status",
              "Actions",
            ]}
            empty={state.templates.length === 0}
          >
            {state.templates.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <Td className="font-mono text-xs">{t.id}</Td>
                <Td>{t.name}</Td>
                <Td className="text-muted-foreground">{t.program}</Td>
                <Td className="tabular-nums">{t.cooldownDays} days</Td>
                <Td className="max-w-64 text-xs text-muted-foreground">
                  {t.requirements}
                </Td>
                <Td>
                  <StatusPill value={t.active ? "Active" : "Pending"} />
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {master && (
                      <>
                        <Button size="xs" variant="outline" onClick={() => startEdit(t)}>
                          <PencilIcon /> Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => saveTemplate({ ...t, active: !t.active })}
                        >
                          {t.active ? "Deactivate" : "Activate"}
                        </Button>
                      </>
                    )}
                    {customize && (
                      <Button size="xs" onClick={() => startOverride(t)}>
                        Customize for {region}
                      </Button>
                    )}
                    {!master && !customize && (
                      <span className="text-xs text-muted-foreground">read-only</span>
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
            Satellite-admin overrides: local eligibility notes and cooldown
            adjustments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["Template", "Region", "Eligibility Note", "Cooldown Override"]}
            empty={state.overrides.length === 0}
          >
            {state.overrides.map((o) => (
              <tr key={`${o.templateId}-${o.region}`} className="border-b last:border-0">
                <Td className="font-mono text-xs">{o.templateId}</Td>
                <Td className="text-muted-foreground">{o.region}</Td>
                <Td className="text-muted-foreground">{o.eligibilityNote || "—"}</Td>
                <Td className="tabular-nums">
                  {o.cooldownDays ? `${o.cooldownDays} days` : "inherits master"}
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <Sheet open={openEdit} onOpenChange={setOpenEdit}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editing ? `Edit ${editing.id}` : "New master template"}</SheetTitle>
            <SheetDescription>System-wide — applies to every region unless overridden.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <Field label="Name" value={tName} onChange={(e) => setTName(e.target.value)} />
            <Field
              label="Program"
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
            <Button onClick={submitTemplate} disabled={!tName || !tProgram}>
              Save template
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={!!overrideFor} onOpenChange={(v) => !v && setOverrideFor(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Customize {overrideFor?.name}</SheetTitle>
            <SheetDescription>
              Applies to {region} only. Blank cooldown inherits the master value
              ({overrideFor?.cooldownDays} days).
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
            <Button onClick={submitOverride}>Save customization</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
