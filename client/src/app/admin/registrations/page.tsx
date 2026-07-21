"use client"

import * as React from "react"

import { useEhelp } from "@/lib/ehelp/store"
import {
  DataTable,
  Field,
  MenuSelect,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ScanFaceIcon, UserPlusIcon } from "lucide-react"

const PREFS = ["Bank", "E-wallet", "Cash pickup"] as const
const KINDS = ["Dependent", "Guarantor"] as const

export default function RegistrationsPage() {
  const {
    state,
    can,
    registerCustomer,
    verifyFaceScan,
    setDisbursementPref,
    registerDependent,
    validateDependent,
  } = useEhelp()
  const { region } = state.session
  const canRegister = can("register-customers")

  const [openCustomer, setOpenCustomer] = React.useState(false)
  const [name, setName] = React.useState("")
  const [philsysId, setPhilsysId] = React.useState("")

  const [openDep, setOpenDep] = React.useState(false)
  const [depName, setDepName] = React.useState("")
  const [depCustomer, setDepCustomer] = React.useState("")
  const [depKind, setDepKind] = React.useState<(typeof KINDS)[number]>("Dependent")
  const [hasRecord, setHasRecord] = React.useState(false)
  const [hasLetter, setHasLetter] = React.useState(false)

  const customerName = (id: string) =>
    state.customers.find((c) => c.id === id)?.name ?? id

  const submitCustomer = () => {
    if (!name || !philsysId) return
    registerCustomer({
      name,
      philsysId,
      region,
      idRecords: true,
      faceScan: "Pending",
      disbursementPref: "—",
    })
    setOpenCustomer(false)
    setName("")
    setPhilsysId("")
  }

  const submitDependent = () => {
    if (!depName || !depCustomer) return
    registerDependent({
      name: depName,
      customerId: depCustomer,
      kind: depKind,
      relationshipRecord: hasRecord,
      notarizedLetter: hasLetter,
    })
    setOpenDep(false)
    setDepName("")
    setDepCustomer("")
    setHasRecord(false)
    setHasLetter(false)
  }

  return (
    <>
      <PageHeader
        title="Registrations"
        description="Customer identity records, face scans, disbursement preference, and linked dependents / guarantors"
      >
        {canRegister && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpenDep(true)}>
              Link dependent / guarantor
            </Button>
            <Button size="sm" onClick={() => setOpenCustomer(true)}>
              <UserPlusIcon /> Register customer
            </Button>
          </div>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>
            Registration requires ID records + face scan; disbursement needs a
            preference on file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={[
              "ID",
              "Name",
              "Region",
              "PhilSys",
              "ID Records",
              "Face Scan",
              "Disbursement Pref",
              "Actions",
            ]}
            empty={state.customers.length === 0}
          >
            {state.customers.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <Td className="font-mono text-xs">{c.id}</Td>
                <Td>{c.name}</Td>
                <Td className="text-muted-foreground">{c.region}</Td>
                <Td className="font-mono text-xs text-muted-foreground">
                  {c.philsysId}
                </Td>
                <Td>
                  <StatusPill value={c.idRecords ? "Verified" : "Pending"} />
                </Td>
                <Td>
                  <StatusPill value={c.faceScan} />
                </Td>
                <Td className="text-muted-foreground">{c.disbursementPref}</Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canRegister && c.faceScan === "Pending" && c.region === region && (
                      <Button size="xs" onClick={() => verifyFaceScan(c.id)}>
                        <ScanFaceIcon /> Capture face scan
                      </Button>
                    )}
                    {canRegister && c.region === region && (
                      <MenuSelect
                        size="xs"
                        value={c.disbursementPref === "—" ? "Set preference" : c.disbursementPref}
                        options={PREFS}
                        onChange={(v) => setDisbursementPref(c.id, v)}
                      />
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
          <CardTitle>Dependents &amp; Guarantors</CardTitle>
          <CardDescription>
            Activation requires relationship record or notarized authorization
            letter, and a validated linked customer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={["ID", "Name", "Kind", "Linked Customer", "Proof", "Status", "Actions"]}
            empty={state.dependents.length === 0}
          >
            {state.dependents.map((d) => {
              const linked = state.customers.find((c) => c.id === d.customerId)
              const linkedValidated = linked?.faceScan === "Verified" && linked.idRecords
              const hasProof = d.relationshipRecord || d.notarizedLetter
              const blocked = !hasProof
                ? "Needs relationship record or notarized authorization letter"
                : !linkedValidated
                  ? "Linked customer account not yet validated (ID + face scan)"
                  : null
              return (
                <tr key={d.id} className="border-b last:border-0">
                  <Td className="font-mono text-xs">{d.id}</Td>
                  <Td>{d.name}</Td>
                  <Td className="text-muted-foreground">{d.kind}</Td>
                  <Td className="text-muted-foreground">
                    {d.customerId} · {customerName(d.customerId)}
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {d.relationshipRecord && "Relationship record"}
                    {d.relationshipRecord && d.notarizedLetter && " + "}
                    {d.notarizedLetter && "Notarized letter"}
                    {!hasProof && "None on file"}
                  </Td>
                  <Td>
                    <StatusPill value={d.status} />
                  </Td>
                  <Td>
                    {canRegister && d.status === "Pending Validation" ? (
                      blocked ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button size="xs" variant="outline" className="opacity-50" />
                            }
                          >
                            Validate
                          </TooltipTrigger>
                          <TooltipContent>{blocked}</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Button size="xs" onClick={() => validateDependent(d.id)}>
                          Validate
                        </Button>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </Td>
                </tr>
              )
            })}
          </DataTable>
        </CardContent>
      </Card>

      <Sheet open={openCustomer} onOpenChange={setOpenCustomer}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Register customer</SheetTitle>
            <SheetDescription>
              Evaluator-side registration for {region}: capture ID records now,
              face scan as a second step.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <Field
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Dela Cruz"
            />
            <Field
              label="PhilSys number"
              value={philsysId}
              onChange={(e) => setPhilsysId(e.target.value)}
              placeholder="PSN-0000-0000-0000"
            />
          </div>
          <SheetFooter>
            <Button onClick={submitCustomer} disabled={!name || !philsysId}>
              Register with ID records
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={openDep} onOpenChange={setOpenDep}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Link dependent or guarantor</SheetTitle>
            <SheetDescription>
              Starts as Pending Validation until proof and the linked account
              check out.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <Field
              label="Full name"
              value={depName}
              onChange={(e) => setDepName(e.target.value)}
              placeholder="Full name"
            />
            <MenuSelect
              label="Kind"
              value={depKind}
              options={KINDS}
              onChange={setDepKind}
            />
            <MenuSelect
              label="Linked customer"
              value={
                depCustomer
                  ? `${depCustomer} · ${customerName(depCustomer)}`
                  : "Select customer"
              }
              options={state.customers.map((c) => `${c.id} · ${c.name}`)}
              onChange={(v) => setDepCustomer(v.split(" · ")[0])}
            />
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasRecord}
                  onChange={(e) => setHasRecord(e.target.checked)}
                />
                Relationship record on file
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={hasLetter}
                  onChange={(e) => setHasLetter(e.target.checked)}
                />
                Notarized authorization letter on file
              </label>
            </div>
          </div>
          <SheetFooter>
            <Button onClick={submitDependent} disabled={!depName || !depCustomer}>
              Link record
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
