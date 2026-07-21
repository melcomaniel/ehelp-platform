/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

const pilots = [
  {
    agency: "DSWD",
    program: "AICS / AKAP",
    shape: "Discretionary, means-tested",
    detail:
      "Eligibility pre-check against CBMS, document upload, case-officer approval.",
    accent: "#A60C0C",
    chipBg: "rgba(166,12,12,0.08)",
    chipColor: "#A60C0C",
  },
  {
    agency: "DOLE",
    program: "TUPAD",
    shape: "Multi-stage, batch-oriented",
    detail: "Barangay endorsement → DOLE field-office validation → payroll.",
    accent: "#0040E7",
    chipBg: "rgba(0,64,231,0.08)",
    chipColor: "#0040E7",
  },
  {
    agency: "OWWA",
    program: "OFW displacement cash aid",
    shape: "Layered identity",
    detail: "OWWA membership check layered on top of PhilSys verification.",
    accent: "#F2C500",
    chipBg: "rgba(242,197,0,0.2)",
    chipColor: "#8a6d00",
  },
];

export function Pilot() {
  return (
    <section id="pilot" className="bg-[#f8fafc] py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#0040E7]">
            Pilot scope
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold text-[#1a1a2e]">
            Three flagship programs, three workflow shapes
          </h2>
          <p className="mt-4 text-[#64748b]">
            Not &ldquo;all agencies&rdquo; on day one. Chosen for maximum
            overlap in beneficiary — informal and displaced worker households —
            and because each proves a different workflow the engine must
            handle.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {pilots.map((p) => (
            <div
              key={p.agency}
              className="rounded-2xl border bg-white p-8 transition-transform hover:-translate-y-1 hover:shadow-lg"
              style={{
                borderColor: `${p.accent}26`,
                borderTopWidth: 4,
                borderTopColor: p.accent,
              }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
                {p.agency}
              </div>
              <div className="mt-2 text-xl font-semibold text-[#1a1a2e]">
                {p.program}
              </div>
              <div
                className="mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: p.chipBg, color: p.chipColor }}
              >
                {p.shape}
              </div>
              <p className="mt-4 text-sm text-[#64748b]">{p.detail}</p>
            </div>
          ))}
        </div>

        {/* CTA banner */}
        <div className="relative mt-16 overflow-hidden rounded-3xl bg-[#0040E7] text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 85% 15%, rgba(242,197,0,0.25), transparent 40%), radial-gradient(circle at 10% 90%, rgba(255,255,255,0.12), transparent 45%)",
            }}
          />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div className="px-8 py-14 lg:pl-14">
              <h3 className="text-2xl sm:text-3xl font-semibold max-w-xl">
                Log in once. Get verified once. See only what you qualify for —
                and what&apos;s{" "}
                <span className="text-[#F2C500]">actually funded</span>.
              </h3>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/signup"
                  className="w-full sm:w-auto text-center rounded-full bg-[#F2C500] px-8 py-3.5 font-semibold text-[#1a1a2e] hover:bg-[#ffd51f] transition-colors"
                >
                  Create an Account
                </Link>
                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto text-center rounded-full border border-white/40 px-8 py-3.5 font-medium text-white hover:bg-white/10 transition-colors"
                >
                  Explore the Console
                </Link>
              </div>
            </div>
            <img
              src="/egov/cta-hand.png"
              alt=""
              aria-hidden
              className="hidden lg:block h-80 w-auto self-end object-contain object-bottom"
            />
          </div>
          {/* Flag stripe base */}
          <div
            aria-hidden
            className="relative h-1.5 w-full"
            style={{
              background:
                "linear-gradient(90deg, #F2C500 0%, #F2C500 25%, #A60C0C 25%, #A60C0C 45%, #ffffff 45%, #ffffff 100%)",
              opacity: 0.9,
            }}
          />
        </div>
      </div>
    </section>
  );
}
