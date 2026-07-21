import { Clock, MapPin, Wallet } from "lucide-react";

const stats = [
  {
    value: "₱926M",
    label: "COA-flagged AKAP funds",
    detail:
      "Paid to unqualified recipients or as double payments — caught only after the money moved.",
    accent: "#A60C0C",
  },
  {
    value: "50,443",
    label: "Probable duplicate beneficiaries",
    detail:
      "Found when PSA matched the old Listahanan-3 database against PhilSys records.",
    accent: "#B58F00",
  },
  {
    value: "15+",
    label: "Agencies, zero shared front door",
    detail:
      "Overlapping cash, livelihood and subsidy programs — each with its own forms, rules and payout channels.",
    accent: "#0040E7",
  },
];

const humanCost = [
  {
    icon: Wallet,
    title: "Lost wages to get aid",
    detail: "A full day queuing means skipping work and losing the day's pay.",
    color: "#A60C0C",
  },
  {
    icon: MapPin,
    title: "Back-and-forth trips",
    detail:
      "Unclear requirements send applicants home to return again and again.",
    color: "#B58F00",
  },
  {
    icon: Clock,
    title: "Weeks in the dark",
    detail:
      "Hours in line, weeks for a result — and no visibility in between.",
    color: "#0040E7",
  },
];

export function Problem() {
  return (
    <section id="problem" className="bg-[#f8fafc] py-20 sm:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#A60C0C]">
            The problem — independently evidenced
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-semibold text-[#1a1a2e]">
            Fragmentation is documented, not hypothetical
          </h2>
          <p className="mt-4 text-[#64748b]">
            COA and PSA findings put numbers on what every applicant already
            knows: nobody can see across agencies — not the citizen, and not the
            auditors until months later.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border bg-white p-8 transition-transform hover:-translate-y-1 hover:shadow-lg"
              style={{ borderColor: `${s.accent}26`, borderTopWidth: 4, borderTopColor: s.accent }}
            >
              <div
                className="text-3xl sm:text-4xl font-semibold"
                style={{ color: s.accent }}
              >
                {s.value}
              </div>
              <div className="mt-2 font-medium text-[#1a1a2e]">{s.label}</div>
              <p className="mt-2 text-sm text-[#64748b]">{s.detail}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {humanCost.map((h) => {
            const Icon = h.icon;
            return (
              <div key={h.title} className="flex gap-4">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ color: h.color, backgroundColor: `${h.color}14` }}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <div className="font-medium text-[#1a1a2e]">{h.title}</div>
                  <p className="mt-1 text-sm text-[#64748b]">{h.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-12 text-center text-sm text-[#64748b] italic">
          The throughline: the people the programs exist for pay the highest
          price to reach them — in time, income, and effort.
        </p>
      </div>
    </section>
  );
}
