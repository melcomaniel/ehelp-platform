"use client"

import * as React from "react"

import { useAdminAccess } from "@/lib/admin/access-provider"
import {
  listStaffAccounts,
  registerStaffAccount,
  type StaffAccountRow,
} from "@/lib/admin/account-actions"
import {
  listOffices,
  requestStaffAccount,
  type OfficeSummary,
} from "@/lib/admin/offices"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckIcon, SearchIcon, UserPlusIcon } from "lucide-react"

const REGISTERABLE = [
  { value: "approver" as const, label: "Approver" },
  { value: "evaluator" as const, label: "Evaluator" },
  { value: "satellite_admin" as const, label: "Regional Administrator" },
]

function RegionalOfficePicker({
  offices,
  value,
  onChange,
}: {
  offices: OfficeSummary[]
  value: string
  onChange: (officeId: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const regionalOffices = React.useMemo(
    () => offices.filter((office) => office.level === "regional"),
    [offices],
  )
  const filteredOffices = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return regionalOffices
    return regionalOffices.filter((office) =>
      `${office.name} ${office.code}`.toLowerCase().includes(needle),
    )
  }, [query, regionalOffices])
  const selectedOffice = regionalOffices.find((office) => office.id === value)

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="regional-office-search">Regional Office</Label>
      <div className="rounded-md border bg-background">
        <div className="flex items-center gap-2 border-b px-3">
          <SearchIcon className="size-4 text-muted-foreground" />
          <Input
            id="regional-office-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              selectedOffice
                ? `${selectedOffice.name} (${selectedOffice.code})`
                : "Search by office name or code"
            }
            className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {filteredOffices.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No active Regional Offices found.
            </p>
          ) : (
            filteredOffices.map((office) => {
              const selected = office.id === value
              return (
                <button
                  key={office.id}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    onChange(office.id)
                    setQuery("")
                  }}
                >
                  <span>
                    <span className="block font-medium">{office.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {office.code}
                    </span>
                  </span>
                  {selected && <CheckIcon className="mt-0.5 size-4 text-primary" />}
                </button>
              )
            })
          )}
        </div>
      </div>
      {selectedOffice && (
        <p className="text-xs text-muted-foreground">
          Selected: {selectedOffice.name} ({selectedOffice.code})
        </p>
      )}
    </div>
  )
}

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

  // Regional Admins can only request Evaluator/Approver staff for their own
  // office — the request awaits Organization Admin approval before the
  // account can log in (device-registration flow), it is not created active.
  const requestOnly = isSatelliteAdmin && !isDswdAdmin && !isPlatformAdmin
  const canRegister = can("register-accounts") && (requestOnly || isDswdAdmin)
  const roleOptions = requestOnly
    ? REGISTERABLE.filter((r) => r.value === "approver" || r.value === "evaluator")
    : isDswdAdmin
      ? REGISTERABLE.filter((r) => r.value === "satellite_admin")
      : []

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
    if (requestOnly) {
      if (!region) {
        setFormError("Your account has no assigned office")
        setBusy(false)
        return
      }
      try {
        await requestStaffAccount(region.id, {
          email,
          full_name: name,
          role: role as "evaluator" | "approver",
        })
      } catch (e) {
        setFormError(e instanceof Error ? e.message : String(e))
        setBusy(false)
        return
      }
    } else {
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
    }
    setOpen(false)
    setName("")
    setEmail("")
    setPassword("")
    setRole(roleOptions[0]?.value ?? "evaluator")
    setOfficeId("")
    setMessage(
      requestOnly
        ? "Staff request submitted — pending Organization Admin approval before the account can sign in."
        : "Staff account created — they can sign in with email/password (mock) or eGov SSO.",
    )
    await reload()
    setBusy(false)
  }

  return (
    <>
      <PageHeader
        title="Staff accounts"
        description={
          requestOnly
            ? "Request Evaluator/Approver accounts for your own office. Requests await Organization Admin approval before sign-in."
            : "Create Regional Administrator accounts for active offices in your organization."
        }
      >
        {canRegister && (
          <Button
            size="sm"
            onClick={() => {
              setRole(roleOptions[0]?.value ?? "evaluator")
              setFormError(null)
              setOpen(true)
            }}
          >
            <UserPlusIcon /> {requestOnly ? "Request Officer account" : "Create Regional Administrator"}
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
                  {a.officeName ?? (a.regionId ? a.regionId.slice(0, 8) : "—")}
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

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setFormError(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {requestOnly ? "Request Officer account" : "Create Regional Administrator"}
            </DialogTitle>
            <DialogDescription>
              {requestOnly
                ? "Submits a request for your own office. The account is created pending and cannot sign in until an Organization Admin approves it."
                : (
                  <>
                    Creates a Regional Administrator account for the selected
                    active office. Temporary password is for mock login; live
                    SSO matches on email.
                  </>
                )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 overflow-y-auto p-5">
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
            {!requestOnly && (
              <Field
                label="Temporary password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
              />
            )}
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
              <RegionalOfficePicker
                offices={offices}
                value={officeId}
                onChange={setOfficeId}
              />
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
          <DialogFooter>
            <Button
              onClick={() => void submit()}
              disabled={
                busy ||
                !name ||
                !email ||
                (!requestOnly && password.length < 8) ||
                (role === "satellite_admin" && !officeId)
              }
            >
              {requestOnly ? "Submit request" : "Create account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
