/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Building2, Smartphone, Users } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pt-28 sm:pt-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,64,231,0.05), transparent 44%), linear-gradient(90deg, rgba(0,64,231,0.035) 1px, transparent 1px), linear-gradient(180deg, rgba(0,64,231,0.035) 1px, transparent 1px)",
          backgroundSize: "auto, 48px 48px, 48px 48px",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-end gap-12 lg:grid-cols-2">
          <div className="pb-12 sm:pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <p className="text-sm font-semibold tracking-wide text-[#0040E7]">
              EHelp
            </p>

            <h1 className="mt-4 text-4xl sm:text-5xl xl:text-6xl font-semibold tracking-tight text-[#1a1a2e] leading-[1.08]">
              Staff &amp; admin portal for social assistance
            </h1>

            <p className="mt-6 max-w-xl text-base sm:text-lg text-[#64748b]">
              Evaluate and approve cases, configure programs and workflows, and
              provision office staff — all against the Nest Core API with the
              same eGov SSO identity model as the mobile app.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-4">
              <Link
                href="/signin"
              className="w-full rounded-lg bg-primary px-8 py-3.5 text-center font-semibold text-white shadow-sm transition-colors hover:bg-[var(--gov-blue-700)] focus-visible:ring-3 focus-visible:ring-ring/45 sm:w-auto"
              >
                Staff sign in
              </Link>
              <a
                href="/get-app"
                download
              className="w-full rounded-lg border border-border px-8 py-3.5 text-center font-semibold text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/45 sm:w-auto"
              >
                Beneficiaries: get the app
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#64748b]">
              <span className="flex items-center gap-1.5">
                <Users size={14} className="text-[#0040E7]" />
                Evaluator &amp; Approver queues
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 size={14} className="text-[#0040E7]" />
                Org &amp; office admin
              </span>
              <span className="flex items-center gap-1.5">
                <Smartphone size={14} className="text-[#0040E7]" />
                Citizens on mobile only
              </span>
            </div>
          </div>

          <div className="relative hidden lg:block self-end animate-in fade-in duration-1000">
            <img
              src="/egov/hero-woman.png"
              alt="EHelp government assistance"
              className="relative z-10 w-full max-w-md mx-auto"
            />
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="brand-stripe relative h-1 w-full"
      />
    </section>
  );
}
