"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const links = [
  { label: "Who it's for", href: "#roles" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Mobile app", href: "#mobile" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-[#0040E7]/8">
      <div
        aria-hidden
        className="h-1 w-full"
        style={{
          background:
            "linear-gradient(90deg, #0040E7 0%, #0040E7 55%, #A60C0C 55%, #A60C0C 75%, #F2C500 75%, #F2C500 100%)",
        }}
      />
      <nav className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Home" className="flex items-center gap-2">
          <img src="/egov/logo.png" alt="eGovPH" className="h-8 w-auto" />
          <span className="hidden sm:inline text-sm font-semibold text-[#1a1a2e]">
            EHelp
          </span>
        </Link>

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
          <Link
            href="/get-app"
            className="text-[0.875rem] text-[#1a1a2e]/70 hover:text-[#0040E7]"
          >
            Get the app
          </Link>
          <Link
            href="/signin"
            className="bg-[#0040E7] text-white text-[0.875rem] font-medium rounded-full px-6 py-2.5 hover:bg-[#0035c2] transition-colors"
          >
            Staff sign in
          </Link>
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
          <Link
            href="/signin"
            onClick={() => setOpen(false)}
            className="bg-[#0040E7] text-white text-center text-[0.875rem] rounded-full px-5 py-2.5"
          >
            Staff sign in
          </Link>
        </div>
      )}
    </header>
  );
}
