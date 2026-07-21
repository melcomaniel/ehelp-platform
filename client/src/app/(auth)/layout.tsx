import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Form side */}
      <div className="flex flex-col px-6 py-10 sm:px-12 lg:px-16">
        <Link href="/" className="inline-flex items-center gap-2" aria-label="Aid Front Door home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/egov/logo.png" alt="eGovPH" className="h-8 w-auto" />
          <span className="text-sm font-semibold text-foreground">
            Aid Front Door
          </span>
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          &copy; {2026} Republic of the Philippines. All rights reserved.
        </p>
      </div>

      {/* Brand side */}
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
            Aid Front Door · eGovHackathon 2026
          </span>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            One front door to government financial aid.
          </h2>
          <p className="mt-4 text-white/80">
            Discover what you qualify for, apply once, and track every step —
            across DSWD, DOLE, OWWA and more. Verified against PhilSys, paid
            through eGovPay, auditable end to end.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/80">
            <li>· See only programs you qualify for — that are actually funded</li>
            <li>· Agencies keep the decision; you finally get the visibility</li>
            <li>· SMS updates at every stage, even without a smartphone</li>
          </ul>
        </div>
        <div className="relative z-10 flex gap-6 text-xs text-white/70">
          <span>PhilSys-verified</span>
          <span>eGovPay settlement</span>
          <span>eGovChain audit trail</span>
        </div>
      </div>
    </div>
  );
}
