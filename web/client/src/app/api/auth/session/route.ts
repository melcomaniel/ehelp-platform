import { NextResponse } from "next/server";

import {
  getNestAccessToken,
  nestServerFetch,
  profileFromNestUser,
  type NestAuthUser,
} from "@/lib/auth/nest-client";

export async function GET() {
  const token = await getNestAccessToken();
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  try {
    const user = await nestServerFetch<NestAuthUser>("/auth/me", { token });
    return NextResponse.json({
      user: profileFromNestUser(user),
      nestUser: user,
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
