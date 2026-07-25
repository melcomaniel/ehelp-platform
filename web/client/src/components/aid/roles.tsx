import {
  ClipboardCheck,
  Landmark,
  Shield,
  UserCog,
  Users,
} from "lucide-react";

const roles = [
  {
    icon: Shield,
    title: "Platform Admin",
    home: "/admin",
    detail:
      "Tenant & platform controls, staff provisioning at the highest scope.",
  },
  {
    icon: Landmark,
    title: "Organization Admin",
    home: "/admin",
    detail:
      "Programs, workflows, templates, and org-wide staff accounts.",
  },
  {
    icon: UserCog,
    title: "Office Admin",
    home: "/admin",
    detail:
      "Office-scoped accounts, regional template customization, oversight.",
  },
  {
    icon: ClipboardCheck,
    title: "Evaluator & Approver",
    home: "/staff",
    detail:
      "Endorse or decide cases in the Nest-backed office queue (SOD).",
  },
  {
    icon: Users,
    title: "Beneficiary",
    home: "Mobile app",
    detail:
      "Apply, track, relationships, and disbursement verification — Flutter only.",
  },
];

export function Roles() {
  return (
    <section id="roles" className="bg-[#f8fafc] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-[#1a1a2e]">
          Who this portal is for
        </h2>
        <p className="mt-3 max-w-2xl text-[#64748b]">
          Web is staff and admin only. Each persona lands on a different home
          after Nest SSO or mock sign-in.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((r) => (
            <div key={r.title} className="rounded-2xl border border-[#e2e8f0] bg-white p-6">
              <r.icon className="size-6 text-[#0040E7]" />
              <h3 className="mt-4 text-lg font-semibold text-[#1a1a2e]">
                {r.title}
              </h3>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-[#0040E7]">
                {r.home}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#64748b]">
                {r.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
