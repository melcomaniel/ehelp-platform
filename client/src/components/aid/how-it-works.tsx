import { BadgeCheck, FileText, Landmark, Search, Send } from "lucide-react";

const steps = [
  {
    icon: Search,
    who: "Citizen",
    title: "Eligibility check",
    detail:
      "Sign in once with eGov SSO, verify against PhilSys, and see only programs you qualify for — that are actually funded.",
    agency: false,
  },
  {
    icon: FileText,
    who: "Citizen",
    title: "Submit documents",
    detail:
      "Upload requirements once. OCR reads them, translation handles Filipino and regional languages.",
    agency: false,
  },
  {
    icon: Landmark,
    who: "Agency",
    title: "Verify & approve",
    detail:
      "Each agency configures its own stages and signs off with its own authorized staff — under its own IRR. We make the step visible, timed and auditable; we never perform it.",
    agency: true,
  },
  {
    icon: Send,
    who: "Platform",
    title: "Trigger payout via eGovPay",
    detail:
      "Disbursement is a call to DICT's live payment rail — not a payment system we build.",
    agency: false,
  },
  {
    icon: BadgeCheck,
    who: "Citizen",
    title: "Status + receipt",
    detail:
      "SMS at every stage — visibility even without a smartphone — and an immutable record anchored on eGovChain.",
    agency: false,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#f8fafc] py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#0040E7]">
            How it works
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold text-[#1a1a2e]">
            Orchestration layer, not the payer — and never the approver
          </h2>
          <p className="mt-4 text-[#64748b]">
            A configurable workflow engine: each agency defines its own stages,
            so onboarding agency #4 through #15 doesn&apos;t need a rewrite.
          </p>
        </div>

        <ol className="mt-12 grid gap-4 lg:grid-cols-5">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <li
                key={s.title}
                className={`relative rounded-2xl border p-6 transition-transform hover:-translate-y-1 hover:shadow-lg ${
                  s.agency
                    ? "border-[#F2C500]/60 bg-[#F2C500]/10"
                    : "border-[#0040E7]/8 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex size-10 items-center justify-center rounded-xl ${
                      s.agency
                        ? "bg-[#F2C500]/25 text-[#1a1a2e]"
                        : "bg-[#0040E7]/8 text-[#0040E7]"
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <span
                    className={`flex size-6 items-center justify-center rounded-full text-[0.65rem] font-bold ${
                      s.agency
                        ? "bg-[#1a1a2e] text-[#F2C500]"
                        : "bg-[#0040E7] text-white"
                    }`}
                  >
                    {i + 1}
                  </span>
                </div>
                <div
                  className={`mt-4 text-xs font-semibold uppercase tracking-wide ${
                    s.agency ? "text-[#8a6d00]" : "text-[#0040E7]"
                  }`}
                >
                  {s.who}
                </div>
                <div className="mt-1 font-medium text-[#1a1a2e]">{s.title}</div>
                <p className="mt-2 text-sm text-[#64748b]">{s.detail}</p>
                {s.agency && (
                  <span className="mt-3 inline-block rounded-full bg-[#1a1a2e] px-3 py-1 text-[0.65rem] font-semibold text-[#F2C500]">
                    Stays under agency authority
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
