import { afterEach, describe, expect, it, vi } from "vitest"

import {
  canArchiveOrganization,
  listOrganizations,
  organizationStatusLabel,
  transitionOrganization,
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
})
