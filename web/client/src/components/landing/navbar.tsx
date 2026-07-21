"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Security", href: "#security" },
  { label: "News", href: "#" },
  { label: "FAQ", href: "#faq" },
  { label: "Developers", href: "#" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-[#0040E7]/8">
      <nav className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <a href="#" aria-label="eGovPH home">
          <img src="/egov/logo.png" alt="eGovPH" className="h-8 w-auto" />
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-[0.875rem] text-[#1a1a2e]/70 hover:text-[#0040E7] transition-colors"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#download"
            className="bg-[#0040E7] text-white text-[0.875rem] font-medium rounded-full px-6 py-2.5 hover:bg-[#0035c2] transition-colors"
          >
            Download App
          </a>
        </div>

        <button
          className="md:hidden text-[#1a1a2e]"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden bg-white border-t border-[#0040E7]/8 px-4 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-[0.938rem] text-[#64748b] hover:text-[#0040E7]"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#download"
            onClick={() => setOpen(false)}
            className="bg-[#0040E7] text-white text-center text-[0.875rem] rounded-full px-5 py-2.5"
          >
            Download App
          </a>
        </div>
      )}
    </header>
  );
}
