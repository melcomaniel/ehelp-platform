"use client"

import * as React from "react"

import { useEhelp } from "@/lib/ehelp/store"
import type { Application } from "@/lib/ehelp/types"
import {
  DataTable,
  MenuSelect,
  PageHeader,
  StatusPill,
  Td,
} from "@/components/ehelp/bits"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PlusIcon } from "lucide-react"

const PRIORITIES = ["High", "Medium", "Low"] as const

export default function ApplicationsPage() {
  const { state, can, cooldownBlock, fileApplication, moveApplication } =
    useEhelp()
  const { role, region } = state.session
  const regional = role === "approver" || role === "evaluator"

  const rows = state.applications.filter(
    (a) => !regional || a.region === region
  )

  const [open, setOpen] = React.useState(false)
  const eligibleCustomers = state.customers.filter((c) => c.region === region)
  const activeTemplates = state.templates.filter((t) => t.active)
  const [customerId, setCustomerId] = React.useState("")
  const [templateId, setTemplateId] = React.useState("")
  const [priority, setPriority] =
    React.useState<(typeof PRIORITIES)[number]>("Medium")

  const customerName = (id: string) =>
    state.customers.find((c) => c.id === id)?.name ?? id
  const templateName = (id: string) =>
    state.templates.find((t) => t.id === id)?.name ?? id

  const submit = () => {
    if (!customerId || !templateId) return
    fileApplication({
      customerId,
      templateId,
      region,
      priority,
      filedBy: "Evaluator",
    })
    setOpen(false)
    setCustomerId("")
    setTemplateId("")
  }

  const actions = (a: Application) => {
    const out: React.ReactNode[] = []
    if (can("evaluate-applications") && a.region === region) {
      if (a.status === "Submitted")
        out.push(
          <Button
            key="eval"
            size="xs"
            variant="outline"
            onClick={() => moveApplication(a.id, "In Evaluation")}
          >
            Start evaluation
          </Button>
        )
      if (a.status === "In Evaluation")
        out.push(
          <Button
            key="send"
            size="xs"
            onClick={() => moveApplication(a.id, "For Approval")}
          >
            Send for approval
          </Button>
        )
    }
    if (can("approve-applications") && a.region === region && a.status === "For Approval") {
      out.push(
        <Button key="ok" size="xs" onClick={() => moveApplication(a.id, "Approved")}>
          Approve
        </Button>,
        <Button
          key="no"
          size="xs"
          variant="destructive"
          onClick={() => moveApplication(a.id, "Declined", "Declined by approver")}
        >
          Decline
        </Button>
      )
    }
    if (can("release-disbursements") && a.region === region && a.status === "Approved") {
      const block = cooldownBlock(a)
      out.push(
        block ? (
          <Tooltip key="pay">
            <TooltipTrigger
              render={
                <Button size="xs" variant="outline" className="opacity-50" />
              }
            >
              Release payout
            </TooltipTrigger>
            <TooltipContent>{block}</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            key="pay"
            size="xs"
            onClick={() => moveApplication(a.id, "Disbursed")}
          >
            Release payout
          </Button>
        )
      )
    }
    return out.length ? out : <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <>
      <PageHeader
        title="Applications"
        description={
          regional
            ? `Case queue for ${region} — actions scoped to your role`
            : "All regions — admins observe; case actions belong to regional roles"
        }
      >
        {can("evaluate-applications") && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <PlusIcon /> File application
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardContent>
          <DataTable
            headers={[
              "Case No.",
              "Customer",
              "Template",
              "Region",
              "Priority",
              "Filed by",
              "Status",
              "Actions",
            ]}
            empty={rows.length === 0}
          >
            {rows.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <Td className="font-mono text-xs">{a.id}</Td>
                <Td>{customerName(a.customerId)}</Td>
                <Td className="text-muted-foreground">
                  {templateName(a.templateId)}
                </Td>
                <Td className="text-muted-foreground">{a.region}</Td>
                <Td>
                  <StatusPill value={a.priority} />
                </Td>
                <Td className="text-muted-foreground">{a.filedBy}</Td>
                <Td>
                  <StatusPill value={a.status} />
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">{actions(a)}</div>
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>File application on behalf of customer</SheetTitle>
            <SheetDescription>
              Evaluator files for a registered customer in {region}. Starts in
              &ldquo;In Evaluation&rdquo;.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <MenuSelect
              label="Customer"
              value={customerId ? `${customerId} · ${customerName(customerId)}` : "Select customer"}
              options={eligibleCustomers.map((c) => `${c.id} · ${c.name}`)}
              onChange={(v) => setCustomerId(v.split(" · ")[0])}
            />
            <MenuSelect
              label="Program template"
              value={templateId ? templateName(templateId) : "Select template"}
              options={activeTemplates.map((t) => t.name)}
              onChange={(v) =>
                setTemplateId(activeTemplates.find((t) => t.name === v)?.id ?? "")
              }
            />
            <MenuSelect
              label="Priority"
              value={priority}
              options={PRIORITIES}
              onChange={setPriority}
            />
            {eligibleCustomers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No registered customers in {region} yet — register one first
                under Registrations.
              </p>
            )}
          </div>
          <SheetFooter>
            <Button onClick={submit} disabled={!customerId || !templateId}>
              File application
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
