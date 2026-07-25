import Link from "next/link";

/** Beneficiary landing — citizens use the Flutter mobile app, not the web dashboard. */
export default function GetAppPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-[#0040E7]">
        EHelp
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Beneficiaries use the mobile app
      </h1>
      <p className="text-muted-foreground leading-relaxed">
        Apply for assistance, track status, manage relationships, and complete
        disbursement verification in the EHelp mobile app. Staff and
        administrators continue on the web portal.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/signin"
          className="rounded-lg bg-[#0040E7] px-4 py-2 text-sm font-medium text-white"
        >
          Staff sign in
        </Link>
        <Link
          href="/"
          className="rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
