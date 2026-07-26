import { describe, expect, it } from "vitest"

import {
  canArchiveOrganization,
  organizationStatusLabel,
} from "./organizations"

describe("organization UI policy", () => {
  it("only enables archive after suspension", () => {
    expect(canArchiveOrganization("active")).toBe(false)
    expect(canArchiveOrganization("suspended")).toBe(true)
    expect(canArchiveOrganization("archived")).toBe(false)
  })

  it("formats lifecycle status labels", () => {
    expect(organizationStatusLabel("active")).toBe("Active")
    expect(organizationStatusLabel("suspended")).toBe("Suspended")
    expect(organizationStatusLabel("archived")).toBe("Archived")
  })
})
