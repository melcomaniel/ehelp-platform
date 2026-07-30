import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.86fr)]">
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-col px-5 py-8 outline-none sm:px-10 lg:px-16"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/45"
          aria-label="EHelp home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/egov/logo.png" alt="eGovPH" className="h-8 w-auto" />
          <span className="text-sm font-semibold text-foreground">
            EHelp Portal
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-7">
            {children}
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          &copy; {2026} Republic of the Philippines. All rights reserved.
        </p>
      </main>

      <aside className="relative hidden overflow-hidden bg-primary text-white lg:flex lg:flex-col lg:justify-between">
        <div className="brand-stripe h-2 w-full" aria-hidden />
        <div className="grid flex-1 content-between gap-10 p-12">
        <div className="relative z-10 flex items-center gap-3">
          <Image src="/egov/seal.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
          <span className="text-sm font-medium tracking-wide">
            EHelp · Staff &amp; Admin
          </span>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            Secure staff access for government service delivery.
          </h2>
          <p className="mt-4 leading-7 text-white/82">
            Evaluators and approvers work the case queue. Admins provision
            accounts, programs, and workflows. Beneficiaries stay on the mobile
            app.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-white/85">
            <li className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              Admin-provisioned accounts before SSO activation
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              Role-based homes for administrators and staff
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              Nest JWT session handling for web clients
            </li>
          </ul>
        </div>
        <div className="relative z-10 flex gap-6 text-xs text-white/70">
          <span>Nest JWT</span>
          <span>eGov SSO</span>
          <span>Office-scoped SOD</span>
        </div>
        </div>
      </aside>
    </div>
  );
}
