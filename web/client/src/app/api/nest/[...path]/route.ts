import { NextResponse, type NextRequest } from "next/server";

import {
  getNestAccessToken,
  nestApiBase,
} from "@/lib/auth/nest-client";

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const targetPath = `/${path.join("/")}`;
  const url = new URL(request.url);
  const target = `${nestApiBase()}${targetPath}${url.search}`;
  const token = await getNestAccessToken();

  const headers = new Headers();
  headers.set("X-Client-Platform", "web");
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.text() : undefined;

  const res = await fetch(target, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}

export async function GET(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return proxy(request, ctx);
}
