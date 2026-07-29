import Link from "next/link";

/** Beneficiary landing — citizens use the Flutter mobile app, not the web dashboard. */
export default function GetAppPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-16 text-center outline-none"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">
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
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-[var(--gov-blue-700)] focus-visible:ring-3 focus-visible:ring-ring/45"
        >
          Staff sign in
        </Link>
        <Link
          href="/"
          className="rounded-lg border px-4 py-2.5 text-sm font-semibold hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/45"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
