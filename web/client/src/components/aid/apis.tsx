const tiers = [
  {
    name: "Tier 1 — Core flow",
    note: "Committed",
    accent: "#0040E7",
    noteBg: "rgba(0,64,231,0.08)",
    noteColor: "#0040E7",
    apis: [
      { name: "eGov SSO", role: "Citizen login — the single front door" },
      { name: "eVerify", role: "PhilSys identity + de-duplication before intake" },
      { name: "Face Liveness", role: "Biometric proof — SUCCEEDED, confidence ≥ 95" },
      { name: "eMessage", role: "SMS/email status at every stage" },
      { name: "eGovPay", role: "Payout / settlement & reconciliation rail" },
    ],
  },
  {
    name: "Tier 2 — Differentiators",
    note: "Win the pitch",
    accent: "#F2C500",
    noteBg: "rgba(242,197,0,0.2)",
    noteColor: "#8a6d00",
    apis: [
      {
        name: "eGovChain",
        role: "Immutable audit trail — structural answer to ghost beneficiaries",
      },
      {
        name: "Compass",
        role: "Live DBM budget data — “is this program actually funded?”",
      },
      {
        name: "eGov AI",
        role: "OCR intake, translation, conversational discovery",
      },
    ],
  },
  {
    name: "Tier 3 — Supporting",
    note: "Optional",
    accent: "#94a3b8",
    noteBg: "rgba(148,163,184,0.15)",
    noteColor: "#475569",
    apis: [
      {
        name: "eReport",
        role: "OTP-verified grievance & appeals + PSA address datasets",
      },
    ],
  },
];

export function Apis() {
  return (
    <section id="apis" className="bg-white py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#0040E7]">
            Built on the host&apos;s own rails
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold text-[#1a1a2e]">
            Seven of nine eGov platform APIs, one coherent flow
          </h2>
          <p className="mt-4 text-[#64748b]">
            Integrate, don&apos;t rebuild: PhilSys for identity, CBMS for
            means data, eGovPay for money movement — and a best-case outcome of
            shipping as a module inside the eGovPH SuperApp, not a competing
            download.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border bg-[#f8fafc] p-6"
              style={{
                borderColor: `${t.accent}33`,
                borderTopWidth: 4,
                borderTopColor: t.accent,
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-[#1a1a2e]">{t.name}</h3>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{ backgroundColor: t.noteBg, color: t.noteColor }}
                >
                  {t.note}
                </span>
              </div>
              <ul className="mt-4 space-y-3">
                {t.apis.map((a) => (
                  <li
                    key={a.name}
                    className="rounded-xl border border-[#0040E7]/8 bg-white p-4 transition-colors hover:border-[#0040E7]/30"
                  >
                    <div className="text-sm font-semibold text-[#0040E7]">
                      {a.name}
                    </div>
                    <p className="mt-1 text-sm text-[#64748b]">{a.role}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
