"use server";

import { redirect } from "next/navigation";

import { clearNestSessionCookie } from "@/lib/auth/nest-client";

export async function signOut() {
  await clearNestSessionCookie();
  redirect("/signin");
}
