"use client"

import * as React from "react"

import { useAdminAccess } from "@/lib/admin/access-provider"
import {
  approveStaffAccount,
  listStaffAccounts,
  registerStaffAccount,
  type StaffAccountRow,
} from "@/lib/admin/account-actions"
import { APP_ROLE_LABEL } from "@/lib/auth/types"
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
import { UserPlusIcon } from "lucide-react"

const REGISTERABLE = [
  { value: "approver" as const, label: "Approver" },
  { value: "evaluator" as const, label: "Evaluator" },
]

export default function AccountsPage() {
  const { can, isDswdAdmin, isSatelliteAdmin, region, loading: accessLoading } =
    useAdminAccess()

  const [accounts, setAccounts] = React.useState<StaffAccountRow[]>([])
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [role, setRole] = React.useState<"approver" | "evaluator">("evaluator")
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    const rows = await listStaffAccounts()
    setAccounts(rows)
  }, [])

  React.useEffect(() => {
    if (!accessLoading) void reload()
  }, [accessLoading, reload])

  const submit = async () => {
    setBusy(true)
    setMessage(null)
    const result = await registerStaffAccount({
      email,
      fullName: name,
      password,
      role,
    })
    if (!result.ok) {
      setMessage(result.error)
      setBusy(false)
      return
    }
    setOpen(false)
    setName("")
    setEmail("")
    setPassword("")
    setRole("evaluator")
    await reload()
    setBusy(false)
  }

  const approve = async (id: string) => {
    setBusy(true)
    setMessage(null)
    const result = await approveStaffAccount(id)
    if (!result.ok) setMessage(result.error)
    else await reload()
    setBusy(false)
  }

  return (
    <>
      <PageHeader
        title="Internal Accounts"
        description={
          isSatelliteAdmin
            ? `Register approvers and evaluators for ${region?.name ?? "your region"}; DSWD Admin approves activation.`
            : "Approve pending regional staff and review internal accounts."
        }
      >
        {can("register-accounts") && isSatelliteAdmin && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <UserPlusIcon /> Register account
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
          <CardTitle>Staff Accounts</CardTitle>
          <CardDescription>
            Roles: Approver and Evaluator are region-scoped; Satellite Admin owns
            the tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={[
              "Name",
              "Email",
              "Role",
              "Region",
              "Status",
              "Active",
              "Actions",
            ]}
            empty={!accessLoading && accounts.length === 0}
          >
            {accounts.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <Td>{a.fullName || "—"}</Td>
                <Td className="text-muted-foreground">{a.email ?? "—"}</Td>
                <Td className="text-muted-foreground">
                  {APP_ROLE_LABEL[a.role]}
                </Td>
                <Td className="text-muted-foreground">
                  {a.regionCode ?? "—"}
                </Td>
                <Td>
                  <StatusPill
                    value={
                      a.validationStatus === "validated"
                        ? "Active"
                        : a.validationStatus === "rejected"
                          ? "Declined"
                          : "Pending Approval"
                    }
                  />
                </Td>
                <Td>
                  <StatusPill value={a.isActive ? "Active" : "Pending"} />
                </Td>
                <Td>
                  {can("approve-accounts") &&
                  isDswdAdmin &&
                  a.validationStatus === "pending" ? (
                    <Button
                      size="xs"
                      disabled={busy}
                      onClick={() => void approve(a.id)}
                    >
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
              Created for {region?.name ?? "your region"} as Approver or
              Evaluator. Lands pending until DSWD Admin approval.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <Field
              label="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Staff full name"
            />
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.gov.ph"
            />
            <Field
              label="Temporary password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
            />
            <MenuSelect
              label="Role"
              value={REGISTERABLE.find((r) => r.value === role)?.label ?? ""}
              options={REGISTERABLE.map((r) => r.label)}
              onChange={(v) =>
                setRole(
                  REGISTERABLE.find((r) => r.label === v)?.value ?? "evaluator",
                )
              }
            />
          </div>
          <SheetFooter>
            <Button
              onClick={() => void submit()}
              disabled={busy || !name || !email || password.length < 8}
            >
              Register (pending approval)
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
