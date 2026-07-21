/* eslint-disable @next/next/no-img-element */

export function Footer() {
  return (
    <footer className="bg-white">
      <div
        aria-hidden
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, #0040E7 0%, #0040E7 55%, #A60C0C 55%, #A60C0C 75%, #F2C500 75%, #F2C500 100%)",
        }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/egov/logo.png" alt="eGovPH" className="h-7 w-auto" />
          <span className="text-sm text-[#64748b]">
            Aid Front Door · eGovHackathon 2026 concept
          </span>
        </div>
        <p className="text-xs text-[#94a3b8]">
          Figures from COA/PSA public findings — verify against the current GAA
          before final pitch use.
        </p>
      </div>
    </footer>
  );
}
