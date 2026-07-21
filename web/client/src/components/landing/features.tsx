import {
  LayoutGrid,
  IdCard,
  Lock,
  Activity,
  Bot,
  Wallet,
} from "lucide-react";
import { Section, SectionHeading } from "./section";

const glowColors = ["#0040E7", "#FCD116", "#CE1126", "#0040E7", "#FCD116", "#CE1126"];

const features = [
  {
    icon: LayoutGrid,
    title: "Unified Government Access",
    description:
      "One platform connecting national and local government services in a single, intuitive app.",
  },
  {
    icon: IdCard,
    title: "Digital ID Integration",
    description:
      "Seamlessly link your Philippine National ID for faster verification and transactions.",
  },
  {
    icon: Lock,
    title: "Secure Login & Verification",
    description:
      "Multi-factor authentication and biometric login to keep your data safe and private.",
  },
  {
    icon: Activity,
    title: "Real-time Application Tracking",
    description:
      "Track the status of permits, requests, and applications — all from your dashboard.",
  },
  {
    icon: Bot,
    title: "AI-powered Assistance",
    description:
      "Get instant help navigating government processes with our intelligent assistant.",
  },
  {
    icon: Wallet,
    title: "Digital ID Wallet",
    description:
      "Securely store and access your government-issued IDs in one digital wallet.",
  },
];

export function Features() {
  return (
    <Section id="features" className="bg-[#f8fafc]">
      <SectionHeading
        eyebrow="Features"
        title="Everything You Need,"
        highlight="In One Place"
        description="Designed for every Filipino — simple, secure, and accessible on any device."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map(({ icon: Icon, title, description }, i) => (
          <div
            key={title}
            className="group relative bg-white rounded-2xl p-8 border border-[#0040E7]/8 transition-shadow hover:shadow-lg"
          >
            <div
              className="w-12 h-12 rounded-xl grid place-items-center mb-5"
              style={{
                backgroundColor: `${glowColors[i]}14`,
                color: glowColors[i] === "#FCD116" ? "#b89600" : glowColors[i],
              }}
            >
              <Icon size={26} />
            </div>
            <h3 className="text-[#1a1a2e] text-[1.063rem] mb-2">{title}</h3>
            <p className="text-[#64748b] text-[0.938rem] leading-relaxed">
              {description}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
