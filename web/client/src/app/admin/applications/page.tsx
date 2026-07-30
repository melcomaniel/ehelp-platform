"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { useEhelp } from "@/lib/ehelp/store"
import {
  DataTable,
  MenuSelect,
  PageHeader,
  StatusPill,
  Td,
} from "@/components/ehelp/bits"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PlusIcon, SearchIcon, XIcon } from "lucide-react"

const PRIORITIES = ["High", "Medium", "Low"] as const
const STATUSES = [
  "Submitted",
  "In Evaluation",
  "For Approval",
  "Approved",
  "Declined",
  "Disbursed",
] as const

export default function ApplicationsPage() {
  const router = useRouter()
  const { state, can, fileApplication } = useEhelp()
  const { role, region } = state.session
  const regional = role === "approver" || role === "evaluator"

  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState("")
  const [regionFilter, setRegionFilter] = React.useState("")

  const customerName = (id: string) =>
    state.customers.find((c) => c.id === id)?.name ?? id
  const templateName = (id: string) =>
    state.templates.find((t) => t.id === id)?.name ?? id

  const rows = state.applications
    .filter((a) => !regional || a.region === region)
    .filter((a) => !status || a.status === status)
    .filter((a) => !regionFilter || a.region === regionFilter)
    .filter((a) => {
      const term = search.toLowerCase()
      if (!term) return true
      return [
        a.id,
        customerName(a.customerId),
        templateName(a.templateId),
        a.region,
        a.priority,
        a.filedBy,
        a.status,
      ].some((value) => value.toLowerCase().includes(term))
    })

  const [open, setOpen] = React.useState(false)
  const eligibleCustomers = state.customers.filter((c) => c.region === region)
  const activeTemplates = state.templates.filter((t) => t.active)
  const [customerId, setCustomerId] = React.useState("")
  const [templateId, setTemplateId] = React.useState("")
  const [priority, setPriority] =
    React.useState<(typeof PRIORITIES)[number]>("Medium")

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
          <form
            className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_180px_180px_auto_auto]"
            onSubmit={(event) => {
              event.preventDefault()
              setSearch(searchInput.trim())
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="application-search">Search</Label>
              <Input
                id="application-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Case no., customer, template"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="application-region">Region</Label>
              <select
                id="application-region"
                className="min-h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45"
                value={regionFilter}
                onChange={(event) => setRegionFilter(event.target.value)}
                disabled={regional}
              >
                <option value="">All regions</option>
                {state.customers
                  .map((customer) => customer.region)
                  .filter((value, index, values) => values.indexOf(value) === index)
                  .map((regionOption) => (
                    <option key={regionOption} value={regionOption}>
                      {regionOption}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="application-status">Status</Label>
              <select
                id="application-status"
                className="min-h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">All statuses</option>
                {STATUSES.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption}
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
                setSearchInput("")
                setSearch("")
                setStatus("")
                setRegionFilter("")
              }}
            >
              <XIcon /> Clear
            </Button>
          </form>
        </CardContent>
      </Card>

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
                    event.preventDefault()
                    router.push(`/admin/applications/${a.id}`)
                  }
                }}
              >
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
