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
            "radial-gradient(circle at 12% 20%, rgba(0,64,231,0.06), transparent 42%), radial-gradient(circle at 90% 35%, rgba(242,197,0,0.10), transparent 45%)",
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
                className="w-full sm:w-auto text-center bg-[#0040E7] text-white font-medium rounded-full px-8 py-3.5 shadow-lg shadow-[#0040E7]/20 hover:bg-[#0035c2] transition-all"
              >
                Staff sign in
              </Link>
              <Link
                href="/get-app"
                className="w-full sm:w-auto text-center rounded-full border border-[#1a1a2e]/15 px-8 py-3.5 font-medium text-[#1a1a2e] hover:border-[#0040E7] hover:text-[#0040E7] transition-colors"
              >
                Beneficiaries: get the app
              </Link>
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
            <div
              aria-hidden
              className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[85%] w-[85%] rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(0,64,231,0.10) 0%, rgba(242,197,0,0.12) 60%, transparent 75%)",
              }}
            />
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
        className="relative h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, #0040E7 0%, #0040E7 60%, #A60C0C 60%, #A60C0C 80%, #F2C500 80%, #F2C500 100%)",
        }}
      />
    </section>
  );
}
