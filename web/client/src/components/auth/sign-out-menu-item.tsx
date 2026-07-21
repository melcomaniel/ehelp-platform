"use client";

import { LogOutIcon } from "lucide-react";

import { signOut } from "@/lib/auth/actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutMenuItem() {
  return (
    <DropdownMenuItem
      variant="destructive"
      onClick={() => {
        void signOut();
      }}
    >
      <LogOutIcon />
      Log out
    </DropdownMenuItem>
  );
}
