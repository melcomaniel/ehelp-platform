/**
 * Nest Core API helper — browser calls go through the Next.js cookie proxy
 * (`/api/nest/...`) so the httpOnly Nest JWT is attached server-side.
 * Server code may pass `token` and set `direct: true` to hit Nest directly.
 */
export async function nestFetch<T>(
  path: string,
  opts: {
    token?: string | null;
    method?: string;
    body?: unknown;
    /** Hit Nest base URL directly (server-only). */
    direct?: boolean;
  } = {},
): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = opts.direct
    ? `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "")}${normalized}`
    : `/api/nest${normalized}`;

  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Platform": "web",
      ...(opts.direct && opts.token
        ? { Authorization: `Bearer ${opts.token}` }
        : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.message === "string"
        ? data.message
        : Array.isArray(data?.message)
          ? data.message.join(", ")
          : `Nest request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export type NestApplication = {
  id: string;
  reference_no: string;
  status: string;
  customer_name?: string | null;
  template_name?: string | null;
  evaluator_notes?: string | null;
  region_id?: string;
};
