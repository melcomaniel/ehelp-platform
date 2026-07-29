import { afterEach, describe, expect, it, vi } from "vitest"

import {
  canArchiveOrganization,
  createOrganizationAdmin,
  listOrganizations,
  organizationStatusLabel,
  reactivateOrganizationAdmin,
  suspendOrganizationAdmin,
  transitionOrganization,
  updateOrganizationAdmin,
} from "./organizations"

describe("organization UI policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("enables archive from active or suspended only", () => {
    expect(canArchiveOrganization("active")).toBe(true)
    expect(canArchiveOrganization("suspended")).toBe(true)
    expect(canArchiveOrganization("archived")).toBe(false)
  })

  it("formats lifecycle status labels", () => {
    expect(organizationStatusLabel("active")).toBe("Active")
    expect(organizationStatusLabel("suspended")).toBe("Suspended")
    expect(organizationStatusLabel("archived")).toBe("Archived")
  })

  it("archives through the canonical platform PATCH endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "org-1", status: "archived" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await transitionOrganization("org-1", "archive", "Tenant offboarding")

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/nest/platform/organizations/org-1/archive",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ reason: "Tenant offboarding" }),
      }),
    )
  })

  it("only requests archived organizations when explicitly included", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          pagination: { page: 1, page_size: 20, total: 0, total_pages: 1 },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await listOrganizations({ includeArchived: true })

    expect(fetchMock.mock.calls[0][0]).toContain("include_archived=true")
  })

  it("creates additional admins through the canonical platform endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "admin-2" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await createOrganizationAdmin("org-1", {
      full_name: "Second Admin",
      email: "second@agency.gov.ph",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/nest/platform/organizations/org-1/admins",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          full_name: "Second Admin",
          email: "second@agency.gov.ph",
        }),
      }),
    )
  })

  it("updates and transitions admins through canonical PATCH requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "org-1", admins: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await updateOrganizationAdmin("org-1", "admin-2", {
      full_name: "Updated Admin",
    })
    await suspendOrganizationAdmin("org-1", "admin-2", "Access review")
    await reactivateOrganizationAdmin("org-1", "admin-2")

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/nest/platform/organizations/org-1/admins/admin-2",
      "/api/nest/platform/organizations/org-1/admins/admin-2",
      "/api/nest/platform/organizations/org-1/admins/admin-2",
    ])
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "suspended", reason: "Access review" }),
      }),
    )
    expect(fetchMock.mock.calls[2][1]).toEqual(
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "active" }),
      }),
    )
  })
})
