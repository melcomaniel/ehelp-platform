"use client";

import Link from "next/link";

/** Staff accounts are admin-provisioned on Nest — no public self-signup. */
export function SignupForm() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-2xl font-semibold">Accounts are provisioned</h1>
        <p className="text-sm text-muted-foreground">
          Evaluators, approvers, and admins are created by Platform, Organization,
          or Office Admins in the portal — then you sign in with eGov SSO and
          complete face liveness. Beneficiaries use the mobile app (same SSO →
          face check; PhilSys eVerify on first use).
        </p>
      </div>

      <ul className="space-y-3 rounded-lg border bg-muted/30 px-4 py-4 text-sm leading-6 text-muted-foreground">
        <li>
          <strong className="text-foreground">Beneficiaries</strong> — install the
          EHelp mobile app and sign in with eGov SSO.
        </li>
        <li>
          <strong className="text-foreground">Staff</strong> — ask your Office or
          Org Admin to create your account under Admin → Accounts.
        </li>
        <li>
          <strong className="text-foreground">Admins</strong> — seeded for local
          demo, or created by a Platform Admin.
        </li>
      </ul>

      <Link
        href="/signin"
        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-[var(--gov-blue-700)] focus-visible:ring-3 focus-visible:ring-ring/45"
      >
        Go to sign in
      </Link>

      <p className="text-center text-sm text-muted-foreground">
        Applying for aid?{" "}
        <a href="/get-app" download className="font-medium text-primary hover:underline">
          Use the mobile app
        </a>
      </p>
    </div>
  );
}
