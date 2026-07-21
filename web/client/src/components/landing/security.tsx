import {
  Landmark,
  ShieldCheck,
  LockKeyhole,
  Fingerprint,
} from "lucide-react";
import { Section } from "./section";

const items = [
  {
    icon: Landmark,
    title: "Government-Backed Platform",
    description:
      "Officially developed and maintained by the Philippine government through DICT.",
  },
  {
    icon: ShieldCheck,
    title: "Data Privacy Compliance",
    description:
      "Fully compliant with the Data Privacy Act of 2012 and NPC regulations.",
  },
  {
    icon: LockKeyhole,
    title: "Encrypted Transactions",
    description:
      "End-to-end encryption protects every transaction and personal information exchange.",
  },
  {
    icon: Fingerprint,
    title: "Secure Authentication",
    description:
      "Multi-factor and biometric authentication for your peace of mind.",
  },
];

export function Security() {
  return (
    <Section id="security" className="bg-[#f8fafc]">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div>
          <span className="inline-block text-[#0040E7] text-[0.813rem] tracking-wider uppercase mb-4">
            Trust &amp; Security
          </span>
          <h2 className="text-[2rem] md:text-[2.5rem] tracking-tight text-[#1a1a2e] mb-4">
            Your Data is <span className="text-[#0040E7]">Safe With Us</span>
          </h2>
          <p className="text-[#64748b] text-[1.063rem] leading-relaxed mb-8">
            eGovPH is built on the highest standards of security and privacy.
            Official. Secure. Convenient.
          </p>
          <div className="inline-flex items-center gap-3 bg-[#0040E7]/8 rounded-xl px-6 py-4">
            <ShieldCheck size={20} className="text-[#0040E7]" />
            <span className="text-[#0040E7] text-[0.875rem]">
              Digital National ID Verification
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {items.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-white rounded-2xl p-6 border border-[#0040E7]/8"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0040E7]/8 text-[#0040E7] grid place-items-center mb-4">
                <Icon size={28} />
              </div>
              <h3 className="text-[#1a1a2e] text-[1rem] mb-2">{title}</h3>
              <p className="text-[#64748b] text-[0.875rem] leading-relaxed">
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
