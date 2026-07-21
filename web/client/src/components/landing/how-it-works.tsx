import { Download, UserCheck, Zap } from "lucide-react";
import { Section, SectionHeading } from "./section";

const steps = [
  {
    step: "01",
    icon: Download,
    title: "Download the App",
    description:
      "Get eGovPH free from the App Store or Google Play. Available for iOS and Android.",
  },
  {
    step: "02",
    icon: UserCheck,
    title: "Verify Your Identity",
    description:
      "Link your Philippine National ID or verify through secure authentication in minutes.",
  },
  {
    step: "03",
    icon: Zap,
    title: "Access Services Instantly",
    description:
      "Browse, apply, and track government services — all from the comfort of your home.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" className="bg-white">
      <SectionHeading
        eyebrow="How It Works"
        title="Get Started in"
        highlight="3 Easy Steps"
        description="From download to access — it only takes minutes to start using eGovPH."
      />
      <div className="grid md:grid-cols-3 gap-8 relative">
        <div className="hidden md:block absolute top-[2.75rem] left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-[#0040E7]/20 via-[#0040E7]/40 to-[#0040E7]/20" />
        {steps.map(({ step, icon: Icon, title, description }) => (
          <div key={step} className="relative text-center px-4">
            <div className="relative inline-grid place-items-center w-[5.5rem] h-[5.5rem] rounded-2xl bg-[#0040E7] text-white mb-6 shadow-lg shadow-[#0040E7]/25">
              <Icon size={32} />
              <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#FCD116] text-[#1a1a2e] text-[0.688rem] font-bold grid place-items-center">
                {step}
              </span>
            </div>
            <h3 className="text-[#1a1a2e] text-[1.125rem] mb-2">{title}</h3>
            <p className="text-[#64748b] text-[0.938rem] leading-relaxed">
              {description}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
