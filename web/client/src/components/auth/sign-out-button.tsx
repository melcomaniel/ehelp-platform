"use client";

import { LogOutIcon } from "lucide-react";

import { signOut } from "@/lib/auth/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        void signOut();
      }}
      className={
        className ??
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
      }
    >
      <LogOutIcon className="size-4" />
      Log out
    </button>
  );
}
