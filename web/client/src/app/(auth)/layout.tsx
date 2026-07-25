import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex flex-col px-6 py-10 sm:px-12 lg:px-16">
        <Link href="/" className="inline-flex items-center gap-2" aria-label="EHelp home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/egov/logo.png" alt="eGovPH" className="h-8 w-auto" />
          <span className="text-sm font-semibold text-foreground">EHelp</span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          &copy; {2026} Republic of the Philippines. All rights reserved.
        </p>
      </div>

      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#0040E7] p-12 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.18), transparent 45%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <Image src="/egov/seal.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
          <span className="text-sm font-medium tracking-wide">
            EHelp · Staff &amp; Admin
          </span>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            Same Nest SSO as mobile — web for staff only.
          </h2>
          <p className="mt-4 text-white/80">
            Evaluators and approvers work the case queue. Admins provision
            accounts, programs, and workflows. Beneficiaries stay on the mobile
            app.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/80">
            <li>· X-Client-Platform: web</li>
            <li>· Admin-provisioned staff before SSO</li>
            <li>· Role homes: /admin · /staff · /get-app</li>
          </ul>
        </div>
        <div className="relative z-10 flex gap-6 text-xs text-white/70">
          <span>Nest JWT</span>
          <span>eGov SSO</span>
          <span>Office-scoped SOD</span>
        </div>
      </div>
    </div>
  );
}
