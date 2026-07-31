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

export type NestDashboardSummary = {
  scope: "office" | "organization";
  organization_id: string;
  office_id: string | null;
  total_applications: number;
  awaiting_approval: number;
  registered_customers: number;
  face_verified_customers: number;
  claimed_or_disbursed: number;
  pending_profile_changes: number;
  pipeline: {
    submitted: number;
    under_review: number;
    recommended: number;
    approved: number;
    claimed: number;
    declined: number;
    cancelled: number;
    draft: number;
  };
  by_location: Array<{ location: string; count: number }>;
  recent_applications: Array<{
    id: string;
    reference_no: string;
    status: string;
    erd_status: string;
    template_name: string | null;
    customer_name: string | null;
    municipality: string | null;
    updated_at: string;
    submitted_at: string | null;
    decided_at: string | null;
  }>;
};

export type NestApplication = {
  id: string;
  reference_no: string;
  status: string;
  customer_name?: string | null;
  template_name?: string | null;
  template_code?: string | null;
  evaluator_notes?: string | null;
  approver_notes?: string | null;
  region_id?: string;
  form_data?: Record<string, unknown>;
  form_fields?: Array<{
    key: string;
    label: string;
    type: string;
    options?: string[];
  }>;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_birth_date?: string | null;
  customer_address?: string | null;
  customer_municipality?: string | null;
  customer_barangay?: string | null;
  amount_requested?: number | null;
  amount_approved?: number | null;
  submitted_at?: string | null;
  decided_at?: string | null;
  created_at?: string | null;
  priority?: string | null;
  erd_status?: string | null;
  current_stage_type?: string | null;
  disbursement_claim?: {
    id: string;
    claimed_at: string;
    queue_number: number;
    slot_starts_at: string;
    slot_ends_at: string;
    site_name: string | null;
    site_address: string | null;
    face_liveness_passed: boolean;
    status: string;
  } | null;
  disbursement_booking?: {
    id: string;
    status: string;
    queue_number: number;
    validated_at: string | null;
    slot_starts_at: string;
    slot_ends_at: string;
    site_name: string | null;
    site_address: string | null;
  } | null;
};
