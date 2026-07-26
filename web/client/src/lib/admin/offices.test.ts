import { describe, expect, it } from "vitest";

import { canArchiveOffice, officeStatusLabel } from "./offices";

describe("office UI policy", () => {
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
});
