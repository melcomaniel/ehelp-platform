import { afterEach, describe, expect, it, vi } from "vitest";

import {
  archiveRegionalOffice,
  canArchiveOffice,
  createOfficeAdmin,
  officeStatusLabel,
  reactivateRegionalOffice,
} from "./offices";

describe("office UI policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("only enables archive for active offices without direct children", () => {
    expect(canArchiveOffice({ status: "active", direct_child_count: 0 })).toBe(
      true,
    );
    expect(canArchiveOffice({ status: "active", direct_child_count: 1 })).toBe(
      false,
    );
    expect(
      canArchiveOffice({ status: "archived", direct_child_count: 0 }),
    ).toBe(false);
  });

  it("formats status labels", () => {
    expect(officeStatusLabel("active")).toBe("Active");
    expect(officeStatusLabel("archived")).toBe("Archived");
  });

  it("archives Regional Offices through the canonical PATCH endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "office-1",
          organization_id: "org-1",
          status: "archived",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await archiveRegionalOffice(
      "org-1",
      "office-1",
      "Regional consolidation",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/nest/organizations/org-1/offices/office-1/archive",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ reason: "Regional consolidation" }),
      }),
    );
  });

  it("reactivates Regional Offices through the canonical PATCH endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "office-1",
          organization_id: "org-1",
          status: "active",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await reactivateRegionalOffice("org-1", "office-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/nest/organizations/org-1/offices/office-1/reactivate",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({}),
      }),
    );
  });

  it("creates a Regional Office admin through the org-scoped POST endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "admin-1",
          email: "admin@region.gov.ph",
          full_name: "Regional Admin",
          phone: null,
          status: "active",
          is_active: true,
          invitation_status: "pending",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createOfficeAdmin("org-1", "office-1", {
      full_name: "Regional Admin",
      email: "admin@region.gov.ph",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/nest/organizations/org-1/offices/office-1/admins",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          full_name: "Regional Admin",
          email: "admin@region.gov.ph",
        }),
      }),
    );
  });
});
