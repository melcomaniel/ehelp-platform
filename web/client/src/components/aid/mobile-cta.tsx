import Link from "next/link";

export function MobileCta() {
  return (
    <section id="mobile" className="bg-[#0040E7] py-16 text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Beneficiaries use the EHelp mobile app
          </h2>
          <p className="mt-2 max-w-xl text-white/80">
            Apply for programs, manage relationships, complete face liveness and
            National ID eVerify, and track disbursement — not on this website.
          </p>
        </div>
        <Link
          href="/get-app"
          className="shrink-0 rounded-full bg-white px-8 py-3.5 text-sm font-medium text-[#0040E7] hover:bg-white/90"
        >
          Get the app
        </Link>
      </div>
    </section>
  );
}
