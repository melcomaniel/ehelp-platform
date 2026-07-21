/* eslint-disable @next/next/no-img-element */
import { ShieldCheck } from "lucide-react";
import { StoreBadges } from "./store-badges";
import { Constellation } from "./constellation";

const stats = [
  { value: "40M+", label: "Downloads" },
  { value: "700M+", label: "Transactions" },
  { value: "4.8★", label: "Rating" },
];

export function Hero() {
  return (
    <section className="relative min-h-screen pt-28 pb-0 md:pt-36 px-4 sm:px-6 lg:px-8 overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-[#fafcff]" style={{ zIndex: -20 }} />
      <Constellation />

      <div
        className="hidden lg:flex absolute left-1/2 bottom-0 top-28 xl:top-36 w-[44%] items-end pointer-events-none"
        style={{ zIndex: 1 }}
      >
        <img
          src="/egov/hero-woman.png"
          alt="Woman pointing at eGovPH app on phone"
          className="block w-full h-auto object-bottom drop-shadow-xl"
          style={{ verticalAlign: "bottom" }}
        />
      </div>

      <div
        className="relative flex-1 flex flex-col justify-center w-full max-w-7xl mx-auto"
        style={{ zIndex: 2 }}
      >
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left lg:max-w-[52%] lg:pr-16 pb-16 md:pb-24">
          <div className="inline-flex items-center gap-2 bg-[#0040E7]/8 text-[#0040E7] rounded-full px-4 py-2 mb-8 text-[0.813rem]">
            <ShieldCheck size={14} />
            <span>Official Government Platform</span>
          </div>

          <h1 className="text-[2.5rem] md:text-[3.25rem] lg:text-[3.75rem] leading-[1.1] tracking-tight text-[#1a1a2e] mb-6">
            All Government Services.{" "}
            <span className="text-[#0040E7]">One App.</span>
          </h1>

          <p className="text-[#64748b] text-[1.125rem] md:text-[1.25rem] leading-relaxed mb-10 max-w-lg mx-auto lg:mx-0">
            Access national and local government services anytime, anywhere —
            securely and seamlessly.
          </p>

          <div className="flex flex-wrap gap-3 justify-center lg:justify-start mb-10">
            <StoreBadges />
          </div>

          <div className="flex gap-8 justify-center lg:justify-start">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-[1.5rem] text-[#0040E7]">{s.value}</div>
                <div className="text-[0.75rem] text-[#64748b] uppercase tracking-wider mt-0.5">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
