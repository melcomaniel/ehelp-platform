import { KeyRound, Smartphone, UserPlus } from "lucide-react";
import Link from "next/link";

const steps = [
  {
    icon: UserPlus,
    title: "Admin provisions staff",
    detail:
      "Organization or Office Admins create Nest accounts under Admin → Accounts. No public self-signup for staff.",
  },
  {
    icon: KeyRound,
    title: "Sign in with SSO (or mock)",
    detail:
      "Web calls Nest POST /auth/sso/exchange with client_platform=web — same identity rail as mobile, different platform gate.",
  },
  {
    icon: Smartphone,
    title: "Citizens stay on mobile",
    detail:
      "Beneficiaries never use this portal. Direct them to the EHelp app for apply, track, and payout verification.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-[#1a1a2e]">
          How web auth works
        </h2>
        <p className="mt-3 max-w-2xl text-[#64748b]">
          One Nest API. Two clients. Roles decide the surface.
        </p>
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="text-xs font-semibold text-[#0040E7]">
                Step {i + 1}
              </span>
              <s.icon className="mt-3 size-6 text-[#0040E7]" />
              <h3 className="mt-3 text-lg font-semibold text-[#1a1a2e]">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#64748b]">
                {s.detail}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-sm text-[#64748b]">
          Already provisioned?{" "}
          <Link href="/signin" className="font-medium text-[#0040E7] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
