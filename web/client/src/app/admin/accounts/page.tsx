"use client"

import * as React from "react"

import { useAdminAccess } from "@/lib/admin/access-provider"
import {
  listStaffAccounts,
  registerStaffAccount,
  type StaffAccountRow,
} from "@/lib/admin/account-actions"
import { listOffices, type OfficeSummary } from "@/lib/admin/offices"
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
  { value: "satellite_admin" as const, label: "Regional Administrator" },
]

export default function AccountsPage() {
  const { can, isDswdAdmin, isSatelliteAdmin, isPlatformAdmin, region, loading: accessLoading } =
    useAdminAccess()

  const [accounts, setAccounts] = React.useState<StaffAccountRow[]>([])
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [role, setRole] = React.useState<"approver" | "evaluator" | "satellite_admin">("evaluator")
  const [officeId, setOfficeId] = React.useState("")
  const [offices, setOffices] = React.useState<OfficeSummary[]>([])
  const [busy, setBusy] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [formError, setFormError] = React.useState<string | null>(null)

  const canRegister = can("register-accounts") && (isSatelliteAdmin || isDswdAdmin || isPlatformAdmin)
  const roleOptions = isPlatformAdmin || isDswdAdmin
    ? REGISTERABLE
    : REGISTERABLE.filter((r) => r.value === "approver" || r.value === "evaluator")

  const reload = React.useCallback(async () => {
    const rows = await listStaffAccounts()
    setAccounts(rows)
  }, [])

  React.useEffect(() => {
    if (!accessLoading) {
      const timer = window.setTimeout(() => void reload(), 0)
      return () => window.clearTimeout(timer)
    }
  }, [accessLoading, reload])

  React.useEffect(() => {
    if (!accessLoading && isDswdAdmin) {
      void listOffices({ status: "active", pageSize: 100 }).then((result) => {
        setOffices(result.data)
      }).catch(() => setOffices([]))
    }
  }, [accessLoading, isDswdAdmin])

  const submit = async () => {
    setBusy(true)
    setMessage(null)
    setFormError(null)
    const result = await registerStaffAccount({
      email,
      fullName: name,
      password,
      role,
      officeId: role === "satellite_admin" ? officeId : undefined,
    })
    if (!result.ok) {
      setFormError(result.error)
      setBusy(false)
      return
    }
    setOpen(false)
    setName("")
    setEmail("")
    setPassword("")
    setRole("evaluator")
    setOfficeId("")
    setMessage("Staff account created — they can sign in with email/password (mock) or eGov SSO.")
    await reload()
    setBusy(false)
  }

  return (
    <>
      <PageHeader
        title="Staff accounts"
        description="Provision Nest web accounts (Evaluator, Approver, Regional Administrator). Staff must exist before SSO on web."
      >
        {canRegister && (
          <Button
            size="sm"
            onClick={() => {
              setFormError(null)
              setOpen(true)
            }}
          >
            <UserPlusIcon /> Create staff account
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
          <CardTitle>Directory</CardTitle>
          <CardDescription>
            Backed by Nest <code className="text-xs">GET /auth/staff</code>
            {region ? ` · office ${region.name}` : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            headers={[
              "Name",
              "Email",
              "Role",
              "Office",
              "Status",
              "Active",
            ]}
            empty={!accessLoading && accounts.length === 0}
          >
            {accounts.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <Td>{a.fullName || "—"}</Td>
                <Td className="text-muted-foreground">{a.email ?? "—"}</Td>
                <Td className="text-muted-foreground">
                  {a.role === "satellite_admin"
                    ? "Regional Administrator"
                    : APP_ROLE_LABEL[a.role] ?? a.role}
                </Td>
                <Td className="text-muted-foreground">
                  {a.regionId ? a.regionId.slice(0, 8) : "—"}
                </Td>
                <Td>
                  <StatusPill value="Active" />
                </Td>
                <Td>
                  <StatusPill value={a.isActive ? "Yes" : "No"} />
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setFormError(null)
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Create staff account</SheetTitle>
            <SheetDescription>
              Creates a Nest <code className="text-xs">user_accounts</code> row +
              role assignment. Temporary password is for mock login; live SSO
              matches on email.
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
              placeholder="staff@example.com"
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
              value={roleOptions.find((r) => r.value === role)?.label ?? ""}
              options={roleOptions.map((r) => r.label)}
              onChange={(v) =>
                setRole(
                  roleOptions.find((r) => r.label === v)?.value ?? "evaluator",
                )
              }
            />
            {role === "satellite_admin" && (
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Regional Office</span>
                <select
                  className="h-9 rounded-md border bg-transparent px-3"
                  value={officeId}
                  onChange={(event) => setOfficeId(event.target.value)}
                  required
                >
                  <option value="">Select a Regional Office</option>
                  {offices.filter((office) => office.level === "regional").map((office) => (
                    <option key={office.id} value={office.id}>
                      {office.name} ({office.code})
                    </option>
                  ))}
                </select>
              </label>
            )}
            {formError && (
              <p
                className="rounded-md border border-destructive bg-destructive/5 p-3 text-sm text-destructive"
                role="alert"
              >
                {formError}
              </p>
            )}
          </div>
          <SheetFooter>
            <Button
              onClick={() => void submit()}
              disabled={
                busy ||
                !name ||
                !email ||
                password.length < 8 ||
                (role === "satellite_admin" && !officeId)
              }
            >
              Create account
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
