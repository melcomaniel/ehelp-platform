"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { useAdminAccess } from "@/lib/admin/access-provider"
import { createOrganization } from "@/lib/admin/organizations"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeftIcon, Building2Icon } from "lucide-react"

export default function NewOrganizationPage() {
  const router = useRouter()
  const { isPlatformAdmin, loading: accessLoading } = useAdminAccess()
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const creationKey = React.useRef<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const data = new FormData(event.currentTarget)
    creationKey.current ??= crypto.randomUUID()
    try {
      const organization = await createOrganization({
        name: String(data.get("name") ?? ""),
        code: String(data.get("code") ?? "").toUpperCase(),
        creation_key: creationKey.current,
        policy_config: {
          mfa_required: true,
          device_registration_required: true,
          session_timeout_minutes: Number(data.get("session_timeout_minutes")),
        },
        initial_admin: {
          full_name: String(data.get("admin_name") ?? ""),
          email: String(data.get("admin_email") ?? "").toLowerCase(),
          phone: String(data.get("admin_phone") ?? "") || undefined,
        },
      })
      router.push(`/admin/organizations/${organization.id}?created=1`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create organization")
    } finally {
      setSubmitting(false)
    }
  }

  if (!accessLoading && !isPlatformAdmin) {
    return (
      <Card>
        <CardHeader><CardTitle>Forbidden</CardTitle></CardHeader>
        <CardContent>Platform Administrator access is required.</CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <Button variant="ghost" render={<Link href="/admin/organizations" />}>
          <ArrowLeftIcon /> Organizations
        </Button>
        <div className="mt-3 flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
            <Building2Icon />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Create organization</h1>
            <p className="text-sm text-muted-foreground">
              The tenant, initial Organization Administrator, role assignment,
              SSO activation, and audit history are created atomically.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Organization details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Organization name</Label>
              <Input id="name" name="name" required minLength={2} maxLength={160} placeholder="Department of Social Welfare and Development" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Organization code</Label>
              <Input
                id="code"
                name="code"
                required
                minLength={2}
                maxLength={32}
                pattern="[A-Za-z0-9][A-Za-z0-9_-]+"
                placeholder="DSWD"
                className="uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Stored uppercase and unique across the platform.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Input value="Active" disabled aria-describedby="status-help" />
              <p id="status-help" className="text-xs text-muted-foreground">
                New organizations start active.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Initial security policy</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="session_timeout_minutes">
                Session timeout (minutes)
              </Label>
              <Input
                id="session_timeout_minutes"
                name="session_timeout_minutes"
                type="number"
                min={5}
                max={30}
                defaultValue={30}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Platform baseline</Label>
              <Input
                value="MFA and device registration required"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                These controls cannot be disabled for an organization.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Initial Organization Administrator</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="admin_name">Full name</Label>
              <Input id="admin_name" name="admin_name" required minLength={2} maxLength={160} autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_email">Government email</Label>
              <Input id="admin_email" name="admin_email" required type="email" maxLength={254} autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_phone">Contact number (optional)</Label>
              <Input id="admin_phone" name="admin_phone" type="tel" maxLength={40} autoComplete="tel" />
            </div>
            <p className="text-sm text-muted-foreground sm:col-span-2">
              The administrator activates access by signing in through the
              existing eGov SSO flow with this provisioned email. No password or
              separate authentication system is created.
            </p>
          </CardContent>
        </Card>

        {error && (
          <p className="rounded-md border border-destructive bg-destructive/5 p-3 text-sm" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" render={<Link href="/admin/organizations" />}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || accessLoading}>
            {submitting ? "Creating…" : "Create organization"}
          </Button>
        </div>
      </form>
    </div>
  )
}
