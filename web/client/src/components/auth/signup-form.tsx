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
          or Office Admins in the portal — then you sign in with eGov SSO (or
          mock password in local dev).
        </p>
      </div>

      <ul className="space-y-3 rounded-xl border bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
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
        className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#0040E7] px-2.5 text-sm font-medium text-white hover:bg-[#0035c2]"
      >
        Go to sign in
      </Link>

      <p className="text-center text-sm text-muted-foreground">
        Applying for aid?{" "}
        <Link href="/get-app" className="font-medium text-[#0040E7] hover:underline">
          Use the mobile app
        </Link>
      </p>
    </div>
  );
}
