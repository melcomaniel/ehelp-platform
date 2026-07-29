import { nestFetch } from "../api/nest"
import type { OfficePage } from "./offices"

export type OrganizationStatus = "active" | "suspended" | "archived"

export type OrganizationSummary = {
  id: string
  code: string
  name: string
  status: OrganizationStatus
  office_count: number
  primary_admin_id: string | null
  primary_admin_email: string | null
  primary_admin_name: string | null
  created_at: string
  updated_at: string
}

export type OrganizationAdmin = {
  id: string
  email: string
  full_name: string
  phone: string | null
  status: string
  is_active: boolean
  invitation_status: string | null
  created_at: string
  updated_at: string
}

export type OrganizationAdminListRow = OrganizationAdmin & {
  organization_id: string
  organization_code: string
  organization_name: string
  organization_status: OrganizationStatus
}

export type OrganizationAudit = {
  id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  reason: string | null
  outcome: string
  occurred_at: string
}

export type OrganizationDetail = {
  id: string
  code: string
  name: string
  status: OrganizationStatus
  policy_config: {
    mfa_required: true
    device_registration_required: true
    session_timeout_minutes: number
  }
  office_count: number
  suspended_at: string | null
  archived_at: string | null
  lifecycle_reason: string | null
  created_at: string
  updated_at: string
  admins: OrganizationAdmin[]
  audit_history: OrganizationAudit[]
}

export type OrganizationPage = {
  data: OrganizationSummary[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

export type OrganizationAdminPage = {
  data: OrganizationAdminListRow[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

export function organizationStatusLabel(status: OrganizationStatus) {
  return status[0].toUpperCase() + status.slice(1)
}

export function canArchiveOrganization(status: OrganizationStatus) {
  return status === "suspended"
}

export function listOrganizations(input: {
  search?: string
  status?: string
  page?: number
  pageSize?: number
}) {
  const query = new URLSearchParams()
  if (input.search) query.set("search", input.search)
  if (input.status) query.set("status", input.status)
  query.set("page", String(input.page ?? 1))
  query.set("page_size", String(input.pageSize ?? 20))
  return nestFetch<OrganizationPage>(
    `/admin/organizations?${query.toString()}`,
  )
}

export function getOrganization(id: string) {
  return nestFetch<OrganizationDetail>(`/admin/organizations/${id}`)
}

export function listOrganizationAdmins(input: {
  search?: string
  status?: string
  invitationStatus?: string
  page?: number
  pageSize?: number
}) {
  const query = new URLSearchParams()
  if (input.search) query.set("search", input.search)
  if (input.status) query.set("status", input.status)
  if (input.invitationStatus) {
    query.set("invitation_status", input.invitationStatus)
  }
  query.set("page", String(input.page ?? 1))
  query.set("page_size", String(input.pageSize ?? 20))
  return nestFetch<OrganizationAdminPage>(
    `/admin/organizations/admins?${query.toString()}`,
  )
}

export function listOrganizationOffices(
  organizationId: string,
  input: {
    search?: string
    status?: string
    level?: string
    page?: number
    pageSize?: number
  },
) {
  const query = new URLSearchParams()
  if (input.search) query.set("search", input.search)
  if (input.status) query.set("status", input.status)
  if (input.level) query.set("level", input.level)
  query.set("page", String(input.page ?? 1))
  query.set("page_size", String(input.pageSize ?? 10))
  return nestFetch<OfficePage>(
    `/admin/organizations/${organizationId}/offices?${query.toString()}`,
  )
}

export function createOrganization(input: {
  name: string
  code: string
  creation_key: string
  policy_config: {
    mfa_required: true
    device_registration_required: true
    session_timeout_minutes: number
  }
  initial_admin: {
    full_name: string
    email: string
    phone?: string
  }
}) {
  return nestFetch<OrganizationDetail>("/admin/organizations", {
    method: "POST",
    body: input,
  })
}

export function updateOrganization(
  id: string,
  input: { name?: string; code?: string },
) {
  return nestFetch<OrganizationDetail>(`/admin/organizations/${id}`, {
    method: "PATCH",
    body: input,
  })
}

export function transitionOrganization(
  id: string,
  action: "suspend" | "reactivate" | "archive",
  reason?: string,
) {
  return nestFetch<OrganizationDetail>(
    `/admin/organizations/${id}/${action}`,
    {
      method: "POST",
      body: reason ? { reason } : {},
    },
  )
}

export function updateOrganizationAdmin(
  organizationId: string,
  adminId: string,
  input: { full_name?: string; email?: string; phone?: string },
) {
  return nestFetch<OrganizationDetail>(
    `/admin/organizations/${organizationId}/admins/${adminId}`,
    { method: "PATCH", body: input },
  )
}

export function suspendOrganizationAdmin(
  organizationId: string,
  adminId: string,
  reason: string,
) {
  return nestFetch<OrganizationDetail>(
    `/admin/organizations/${organizationId}/admins/${adminId}/suspend`,
    { method: "POST", body: { reason } },
  )
}
