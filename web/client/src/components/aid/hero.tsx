/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { BellRing, ShieldCheck, Wallet } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pt-28 sm:pt-32">
      {/* Ambient wash */}
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
          {/* Copy */}
          <div className="pb-12 sm:pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#0040E7]/15 bg-[#0040E7]/5 px-4 py-1.5 text-xs font-semibold text-[#0040E7]">
              eGovHackathon 2026 · DICT · SMX Aura, Jul 21–22
            </span>

            <h1 className="mt-6 text-4xl sm:text-5xl xl:text-6xl font-semibold tracking-tight text-[#1a1a2e] leading-[1.08]">
              One front door to government{" "}
              <span
                className="text-[#0040E7]"
                style={{
                  background:
                    "linear-gradient(transparent 66%, rgba(242,197,0,0.45) 66%, rgba(242,197,0,0.45) 94%, transparent 94%)",
                }}
              >
                financial aid
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base sm:text-lg text-[#64748b]">
              Discover what you qualify for, apply once, and track every step —
              across DSWD, DOLE, OWWA and more. Agencies keep the decision;
              citizens finally get the visibility.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto text-center bg-[#0040E7] text-white font-medium rounded-full px-8 py-3.5 shadow-lg shadow-[#0040E7]/20 hover:bg-[#0035c2] transition-all"
              >
                Check My Eligibility
              </Link>
              <Link
                href="/dashboard"
                className="w-full sm:w-auto text-center rounded-full border border-[#1a1a2e]/15 px-8 py-3.5 font-medium text-[#1a1a2e] hover:border-[#0040E7] hover:text-[#0040E7] transition-colors"
              >
                View Console Demo
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#64748b]">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#0040E7]" />
                PhilSys-verified, once
              </span>
              <span className="flex items-center gap-1.5">
                <Wallet size={14} className="text-[#0040E7]" />
                Paid through eGovPay
              </span>
              <span className="flex items-center gap-1.5">
                <BellRing size={14} className="text-[#0040E7]" />
                SMS updates, no smartphone needed
              </span>
            </div>
          </div>

          {/* Visual */}
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
              alt="Citizen checking aid programs on the eGovPH app"
              className="relative z-10 w-full max-w-md mx-auto"
            />
          </div>
        </div>
      </div>

      {/* Flag stripe divider */}
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
