"use client"

import * as React from "react"

import { useEhelp } from "@/lib/ehelp/store"
import type { Role } from "@/lib/ehelp/types"
import { ROLE_LABEL } from "@/lib/ehelp/types"
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
import { KeyRoundIcon, UserPlusIcon } from "lucide-react"

const REGISTERABLE: Role[] = ["approver", "evaluator"]

export default function AccountsPage() {
  const { state, can, registerAccount, approveAccount } = useEhelp()
  const { region } = state.session

  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [role, setRole] = React.useState<Role>("evaluator")

  const submit = () => {
    if (!name) return
    registerAccount({
      name,
      role,
      region,
      pinAgeDays: 0,
      otpEnabled: false,
      faceEnrolled: false,
    })
    setOpen(false)
    setName("")
  }

  return (
    <>
      <PageHeader
        title="Internal Accounts"
        description="Satellite admins register regional staff; DSWD Admin approves activation. PIN expires at 90 days."
      >
        {can("register-accounts") && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <UserPlusIcon /> Register account
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Staff Accounts</CardTitle>
          <CardDescription>
            Auth factors: PIN (90-day expiry) + OTP + face scan enrolment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={[
              "ID",
              "Name",
              "Role",
              "Region",
              "PIN Age",
              "OTP",
              "Face",
              "Status",
              "Actions",
            ]}
            empty={state.accounts.length === 0}
          >
            {state.accounts.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <Td className="font-mono text-xs">{a.id}</Td>
                <Td>{a.name}</Td>
                <Td className="text-muted-foreground">{ROLE_LABEL[a.role]}</Td>
                <Td className="text-muted-foreground">{a.region}</Td>
                <Td>
                  {a.pinAgeDays > 90 ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                      <KeyRoundIcon className="size-3" /> Expired ({a.pinAgeDays}d)
                    </span>
                  ) : (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {a.pinAgeDays}d / 90d
                    </span>
                  )}
                </Td>
                <Td>
                  <StatusPill value={a.otpEnabled ? "Active" : "Pending"} />
                </Td>
                <Td>
                  <StatusPill value={a.faceEnrolled ? "Verified" : "Pending"} />
                </Td>
                <Td>
                  <StatusPill value={a.status} />
                </Td>
                <Td>
                  {can("approve-accounts") && a.status === "Pending Approval" ? (
                    <Button size="xs" onClick={() => approveAccount(a.id)}>
                      Approve
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Register internal account</SheetTitle>
            <SheetDescription>
              Created for {region}, lands in DSWD Admin&apos;s approval queue
              before activation.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <Field
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Staff full name"
            />
            <MenuSelect
              label="Role"
              value={ROLE_LABEL[role]}
              options={REGISTERABLE.map((r) => ROLE_LABEL[r])}
              onChange={(v) =>
                setRole(REGISTERABLE.find((r) => ROLE_LABEL[r] === v) ?? "evaluator")
              }
            />
          </div>
          <SheetFooter>
            <Button onClick={submit} disabled={!name}>
              Register (pending approval)
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
