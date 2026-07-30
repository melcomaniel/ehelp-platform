"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { useAdminAccess } from "@/lib/admin/access-provider"
import { createOrganization } from "@/lib/admin/organizations"
import { PageHeader } from "@/components/ehelp/bits"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  ArrowLeftIcon,
  Building2Icon,
  CheckCircle2Icon,
  ShieldCheckIcon,
  UserRoundPlusIcon,
} from "lucide-react"

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
    } catch {
      setError("We could not create the organization. Check the highlighted fields and try again.")
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
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <div>
        <Button variant="ghost" render={<Link href="/admin/organizations" />}>
          <ArrowLeftIcon /> Organizations
        </Button>
        <div className="mt-4">
          <PageHeader
            title="Create Organization"
            description="Create the tenant, initial Organization Administrator, role assignment, SSO activation record, and audit history in one controlled action."
          />
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2Icon className="size-5" aria-hidden />
              </div>
              <div>
                <CardTitle>Organization details</CardTitle>
                <CardDescription>
                  Use the official agency or government office name and a short unique code.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Organization name <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={160}
                placeholder="Department of Social Welfare and Development"
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Organization code <span className="text-destructive">*</span></Label>
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
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-800">
                <ShieldCheckIcon className="size-5" aria-hidden />
              </div>
              <div>
                <CardTitle>Initial security policy</CardTitle>
                <CardDescription>
                  Platform security controls are enforced for every new tenant.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="session_timeout_minutes">
                Session timeout (minutes) <span className="text-destructive">*</span>
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
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-red-50 text-red-700">
                <UserRoundPlusIcon className="size-5" aria-hidden />
              </div>
              <div>
                <CardTitle>Initial Organization Administrator</CardTitle>
                <CardDescription>
                  This account becomes the first administrator for the organization.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="admin_name">Full name <span className="text-destructive">*</span></Label>
              <Input id="admin_name" name="admin_name" required minLength={2} maxLength={160} autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_email">Email address <span className="text-destructive">*</span></Label>
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
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Creation checklist</CardTitle>
              <CardDescription>
                These controls are preserved by the backend contract.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                "Unique tenant code",
                "MFA required",
                "Device registration required",
                "30-minute maximum session",
                "Initial admin activation through SSO",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-[var(--shadow-soft)]">
          <Button variant="outline" render={<Link href="/admin/organizations" />}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || accessLoading}>
            {submitting ? "Creating organization..." : "Create organization"}
          </Button>
          </div>
        </aside>
      </form>
    </div>
  )
}
