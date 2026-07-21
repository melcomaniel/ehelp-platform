"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Section, SectionHeading } from "./section";

const faqs = [
  {
    q: "Is eGovPH free to use?",
    a: "Yes! eGovPH is completely free to download and use. It's a public service initiative by the Philippine government to make government services accessible to all citizens.",
  },
  {
    q: "Is my personal data safe?",
    a: "Absolutely. eGovPH uses end-to-end encryption, secure authentication, and is fully compliant with the Data Privacy Act of 2012. Your personal information is protected at every step.",
  },
  {
    q: "What government services are available?",
    a: "eGovPH connects you to national and local government services — including National ID, NBI clearance, SSS, Pag-IBIG, PhilHealth, passport appointments, business permits, and more — with new services added regularly.",
  },
  {
    q: "How do I verify my identity?",
    a: "You can verify your identity by linking your Philippine National ID (PhilSys), or through a secure in-app verification process using valid government-issued IDs and facial recognition.",
  },
  {
    q: "Can I use eGovPH on multiple devices?",
    a: "Yes, you can access your eGovPH account from any device. Simply log in with your credentials and your data will sync across all your devices.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <Section id="faq" className="bg-white">
      <div className="max-w-3xl mx-auto">
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently Asked"
          highlight="Questions"
          description="Everything you need to know about eGovPH."
        />
        <div className="space-y-3">
          {faqs.map((item, i) => {
            const open = openIndex === i;
            return (
              <div
                key={item.q}
                className={`rounded-2xl border transition-colors duration-300 ${
                  open
                    ? "border-[#0040E7]/20 bg-[#f0f4ff]/50 shadow-sm"
                    : "border-[#0040E7]/8 bg-white"
                }`}
              >
                <button
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                  onClick={() => setOpenIndex(open ? null : i)}
                  aria-expanded={open}
                >
                  <span className="text-[#1a1a2e] text-[0.938rem]">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-[#0040E7] transition-transform duration-300 ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {open && (
                  <p className="px-6 pb-5 text-[#64748b] text-[0.875rem] leading-relaxed">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
