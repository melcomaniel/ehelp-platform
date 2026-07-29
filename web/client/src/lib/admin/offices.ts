import { nestFetch } from "../api/nest";

export type OfficeStatus = "active" | "archived";
export type OfficeLevel = "central" | "regional" | "provincial" | "municipal";

export type OfficeSummary = {
  id: string;
  organization_id: string;
  organization_name: string;
  parent_office_id: string | null;
  parent_office_name: string | null;
  name: string;
  code: string;
  normalized_code: string;
  level: OfficeLevel;
  status: OfficeStatus;
  direct_child_count: number;
  archived_at: string | null;
  lifecycle_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type OfficeAudit = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reason: string | null;
  outcome: string;
  occurred_at: string;
};

export type OfficeDetail = OfficeSummary & {
  child_offices: OfficeSummary[];
  audit_history: OfficeAudit[];
};

export type OfficePage = {
  data: OfficeSummary[];
  organization: { id: string; name: string };
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};

export type OfficeAdmin = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  status: string;
  is_active: boolean;
  invitation_status: string | null;
  created_at: string;
  updated_at: string;
};

export type ParentOfficeOption = {
  id: string;
  name: string;
  code: string;
  level: OfficeLevel;
};

export const OFFICE_LEVEL_LABEL: Record<OfficeLevel, string> = {
  central: "Central",
  regional: "Regional",
  provincial: "Provincial",
  municipal: "Municipal or City",
};

export function officeStatusLabel(status: OfficeStatus) {
  return status[0].toUpperCase() + status.slice(1);
}

export function canArchiveOffice(
  office: Pick<OfficeSummary, "status" | "direct_child_count">,
) {
  return office.status === "active" && office.direct_child_count === 0;
}

export function listOffices(input: {
  search?: string;
  status?: string;
  level?: string;
  parentOfficeId?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();
  if (input.search) query.set("search", input.search);
  if (input.status) query.set("status", input.status);
  if (input.level) query.set("level", input.level);
  if (input.parentOfficeId) query.set("parent_office_id", input.parentOfficeId);
  query.set("page", String(input.page ?? 1));
  query.set("page_size", String(input.pageSize ?? 20));
  return nestFetch<OfficePage>(`/admin/offices?${query.toString()}`);
}

export function listParentOfficeOptions(excludeOfficeId?: string) {
  const query = new URLSearchParams();
  if (excludeOfficeId) query.set("exclude_office_id", excludeOfficeId);
  return nestFetch<{ data: ParentOfficeOption[] }>(
    `/admin/offices/parent-options?${query.toString()}`,
  );
}

export function getOffice(id: string) {
  return nestFetch<OfficeDetail>(`/admin/offices/${id}`);
}

export function createOffice(input: {
  name: string;
  code: string;
  level: OfficeLevel;
  parent_office_id?: string | null;
}) {
  return nestFetch<OfficeDetail>("/admin/offices", {
    method: "POST",
    body: input,
  });
}

export function createRegionalOffice(
  organizationId: string,
  input: {
    name: string;
    code: string;
  },
) {
  return nestFetch<OfficeDetail>(`/organizations/${organizationId}/offices`, {
    method: "POST",
    body: input,
  });
}

export function updateOffice(
  id: string,
  input: {
    name?: string;
    code?: string;
    level?: OfficeLevel;
    parent_office_id?: string | null;
  },
) {
  return nestFetch<OfficeDetail>(`/admin/offices/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function archiveOffice(id: string, reason: string) {
  return nestFetch<OfficeDetail>(`/admin/offices/${id}/archive`, {
    method: "POST",
    body: { reason },
  });
}

export function archiveRegionalOffice(
  organizationId: string,
  officeId: string,
  reason: string,
) {
  return nestFetch<OfficeDetail>(
    `/organizations/${organizationId}/offices/${officeId}/archive`,
    {
      method: "PATCH",
      body: { reason },
    },
  );
}

export function reactivateOffice(id: string) {
  return nestFetch<OfficeDetail>(`/admin/offices/${id}/reactivate`, {
    method: "POST",
    body: {},
  });
}

export function reactivateRegionalOffice(
  organizationId: string,
  officeId: string,
) {
  return nestFetch<OfficeDetail>(
    `/organizations/${organizationId}/offices/${officeId}/reactivate`,
    {
      method: "PATCH",
      body: {},
    },
  );
}

export function createOfficeAdmin(
  organizationId: string,
  officeId: string,
  input: { full_name: string; email: string; phone?: string },
) {
  return nestFetch<OfficeAdmin>(
    `/organizations/${organizationId}/offices/${officeId}/admins`,
    {
      method: "POST",
      body: input,
    },
  );
}
