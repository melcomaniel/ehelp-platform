"use client";

import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        void (async () => {
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
          router.replace("/signin");
          router.refresh();
        })();
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
