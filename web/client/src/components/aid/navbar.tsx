"use client";

import { useState } from "react";
import Link from "next/link";
import { HandHeartIcon, Menu, X } from "lucide-react";

const links = [
  { label: "Who it's for", href: "#roles" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Mobile app", href: "#mobile" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-white/90 backdrop-blur-md">
      <div aria-hidden className="brand-stripe h-1 w-full" />
      <nav className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="EHelp home"
          className="flex items-center gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/45"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HandHeartIcon className="size-4" aria-hidden />
          </span>
          <span className="hidden sm:inline text-sm font-semibold text-[#1a1a2e]">
            EHelp
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="rounded-md text-[0.875rem] text-muted-foreground transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/45"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/get-app"
            className="rounded-md text-[0.875rem] text-muted-foreground hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/45"
          >
            Get the app
          </Link>
          <Link
            href="/signin"
            className="rounded-lg bg-primary px-5 py-2.5 text-[0.875rem] font-semibold text-white transition-colors hover:bg-[var(--gov-blue-700)] focus-visible:ring-3 focus-visible:ring-ring/45"
          >
            Staff sign in
          </Link>
        </div>

        <button
          className="touch-target inline-flex items-center justify-center rounded-lg text-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/45 md:hidden"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {open && (
        <div
          id="mobile-navigation"
          className="flex flex-col gap-3 border-t border-border bg-white px-4 py-4 md:hidden"
        >
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2 text-[0.938rem] text-muted-foreground hover:bg-muted hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/45"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/signin"
            onClick={() => setOpen(false)}
            className="rounded-lg bg-primary px-5 py-3 text-center text-[0.875rem] font-semibold text-white"
          >
            Staff sign in
          </Link>
        </div>
      )}
    </header>
  );
}
