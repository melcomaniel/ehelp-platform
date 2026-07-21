import { Clock, FileStack, Network } from "lucide-react";
import { Section, SectionHeading } from "./section";

const problems = [
  {
    icon: Clock,
    title: "Long Queues",
    description: "Hours spent waiting in government offices for simple transactions.",
  },
  {
    icon: FileStack,
    title: "Paper-based Processing",
    description: "Redundant paperwork, manual forms, and slow approvals.",
  },
  {
    icon: Network,
    title: "Fragmented Systems",
    description: "Different agencies, different portals, different requirements.",
  },
];

export function Problem() {
  return (
    <Section className="bg-white">
      <SectionHeading
        eyebrow="The Problem"
        title="Government Services,"
        highlight="Simplified."
        description="Filipino citizens deserve better access to public services. No more unnecessary trips, lost documents, or confusing processes."
      />
      <div className="grid md:grid-cols-3 gap-6">
        {problems.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="relative bg-[#fef2f2] rounded-2xl p-8 border border-[#CE1126]/8"
          >
            <div className="w-14 h-14 rounded-xl bg-[#CE1126]/10 text-[#CE1126] grid place-items-center mb-5">
              <Icon size={28} />
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
