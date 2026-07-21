/* eslint-disable @next/next/no-img-element */
import { Smartphone } from "lucide-react";
import { StoreBadges } from "./store-badges";

export function Cta() {
  return (
    <section id="download" className="px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <div className="max-w-7xl mx-auto">
        <div className="relative bg-gradient-to-br from-[#0040E7] to-[#002aab] rounded-3xl overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#FCD116]/10 rounded-full translate-y-1/3 -translate-x-1/3" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full" />

          <div className="relative z-10 grid lg:grid-cols-2 gap-0 items-end p-8 md:p-12 lg:p-16 lg:pr-0">
            <div className="text-center lg:text-left self-center">
              <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-2 text-[0.813rem] text-white/90 mb-6">
                <Smartphone size={14} />
                <span>Available on iOS, Android &amp; App Gallery</span>
              </div>
              <h2 className="text-[2rem] md:text-[2.5rem] tracking-tight text-white mb-4 leading-tight">
                Start Using eGovPH Today
              </h2>
              <p className="text-white/70 text-[1.063rem] leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
                Used by millions of Filipinos nationwide. Join them and
                experience government services like never before.
              </p>
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start mb-10 lg:mb-0">
                <StoreBadges />
              </div>
            </div>

            <div className="hidden lg:flex justify-end items-end">
              <img
                src="/egov/cta-hand.png"
                alt="Hand holding phone with eGovPH app"
                className="w-full max-w-[480px] object-contain object-bottom select-none"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
