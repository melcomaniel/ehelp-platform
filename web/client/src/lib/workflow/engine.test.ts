import { describe, expect, it } from "vitest"

import {
  allowedActions,
  copyStepSet,
  decide,
  disburse,
  reviewItemsOf,
  reviewProgress,
  submit,
  validateAnswers,
  verify,
} from "./engine"
import { SEED } from "./seed"
import type { WorkflowState } from "./types"

let n = 0
const idGen = (prefix: string) => `${prefix}-TEST-${++n}`
const at = "2026-07-21T12:00:00.000Z"

const REVIEW_STEP = "ST-P-REV"
const SECOND_REVIEW_STEP = "ST-P-APPR" // "Director Review" — also a review step
const DISBURSE_STEP = "ST-P-DSB"
const REVIEWER = "U-REV"
const APPROVER = "U-APPR"
const ADMIN = "U-ADMIN"

const clone = (): WorkflowState => JSON.parse(JSON.stringify(SEED))

/** Mark every checklist item verified on the app's current review step. */
function verifyCurrentReview(state: WorkflowState, appId: string): WorkflowState {
  const app = state.applications.find((a) => a.id === appId)!
  const version = state.versions.find((v) => v.id === app.programVersionId)!
  const items = reviewItemsOf(state, appId, version.stepSetId)
  return {
    ...state,
    reviewChecks: [
      ...state.reviewChecks,
      ...items.map((it, i) => ({
        id: `RCK-${appId}-${i}`,
        applicationId: appId,
        stepId: app.currentStepId!,
        itemKey: it.key,
        verdict: "approved" as const,
        checkedBy: "U-REV",
        at,
      })),
    ],
  }
}

describe("decide — guards", () => {
  it("refuses a decision from the wrong role", () => {
    const result = decide(clone(), {
      applicationId: "APP-001", // waiting at review
      action: "approve",
      actorId: APPROVER, // approver ≠ reviewer
      at,
      idGen,
    })
    expect(result.ok).toBe(false)
  })

  it("refuses an applicant trying to approve", () => {
    const result = decide(clone(), {
      applicationId: "APP-001",
      action: "approve",
      actorId: "U-APP-1",
      at,
      idGen,
    })
    expect(result.ok).toBe(false)
  })

  it("refuses return without a comment when comment is required", () => {
    const result = decide(clone(), {
      applicationId: "APP-001",
      action: "return",
      actorId: REVIEWER,
      reasonCodeId: "RC-P-REV-RET-1",
      comment: "  ",
      at,
      idGen,
    })
    expect(result.ok).toBe(false)
  })

  it("refuses return/reject without a reason code", () => {
    const result = decide(clone(), {
      applicationId: "APP-001",
      action: "reject",
      actorId: REVIEWER,
      comment: "No valid ground",
      at,
      idGen,
    })
    expect(result.ok).toBe(false)
  })

  it("refuses actions on terminal applications", () => {
    for (const id of ["APP-010", "APP-011"]) {
      const result = decide(clone(), {
        applicationId: id,
        action: "approve",
        actorId: APPROVER,
        at,
        idGen,
      })
      expect(result.ok).toBe(false)
    }
  })

  it("refuses a disabled action", () => {
    const state = clone()
    const action = state.stepActions.find(
      (a) => a.stepId === REVIEW_STEP && a.action === "return"
    )!
    action.enabled = false
    const result = decide(state, {
      applicationId: "APP-001",
      action: "return",
      actorId: REVIEWER,
      reasonCodeId: "RC-P-REV-RET-1",
      comment: "please comply",
      at,
      idGen,
    })
    expect(result.ok).toBe(false)
  })

  it("human lock: a returned application never advances without a human decision", () => {
    const state = clone()
    const app = state.applications.find((a) => a.id === "APP-009")!
    expect(app.status).toBe("returned")
    // only path forward is applicant resubmit + human approve
    const result = decide(state, {
      applicationId: "APP-009",
      action: "approve",
      actorId: REVIEWER,
      at,
      idGen,
    })
    expect(result.ok).toBe(false) // not submitted → no decision possible
  })
})

describe("decide — transitions", () => {
  it("approve at review advances to the second review", () => {
    const result = decide(verifyCurrentReview(clone(), "APP-001"), {
      applicationId: "APP-001",
      action: "approve",
      actorId: REVIEWER,
      at,
      idGen,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const app = result.state.applications.find((a) => a.id === "APP-001")!
    expect(app.status).toBe("submitted")
    expect(app.currentStepId).toBe(SECOND_REVIEW_STEP)
  })

  it("approve at the last decision routes to the disbursement step", () => {
    const result = decide(verifyCurrentReview(clone(), "APP-007"), {
      applicationId: "APP-007", // waiting at the second review
      action: "approve",
      actorId: APPROVER,
      at,
      idGen,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const app = result.state.applications.find((a) => a.id === "APP-007")!
    expect(app.status).toBe("approved")
    expect(app.currentStepId).toBe(DISBURSE_STEP)
  })

  it("return keeps the step pinned and appends the reason + comment event", () => {
    const result = decide(clone(), {
      applicationId: "APP-002",
      action: "return",
      actorId: REVIEWER,
      reasonCodeId: "RC-P-REV-RET-1",
      comment: "Missing barangay certificate.",
      at,
      idGen,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const app = result.state.applications.find((a) => a.id === "APP-002")!
    expect(app.status).toBe("returned")
    expect(app.currentStepId).toBe(REVIEW_STEP)
    const event = result.state.events.at(-1)!
    expect(event.action).toBe("return")
    expect(event.reasonCodeId).toBe("RC-P-REV-RET-1")
    expect(event.comment).toBe("Missing barangay certificate.")
    // append-only: nothing removed
    expect(result.state.events.length).toBe(SEED.events.length + 1)
  })

  it("reject is terminal", () => {
    const first = decide(clone(), {
      applicationId: "APP-003",
      action: "reject",
      actorId: REVIEWER,
      reasonCodeId: "RC-P-REV-REJ-1",
      comment: "Outside program coverage.",
      at,
      idGen,
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const again = decide(first.state, {
      applicationId: "APP-003",
      action: "approve",
      actorId: REVIEWER,
      at,
      idGen,
    })
    expect(again.ok).toBe(false)
  })
})

describe("submit / resubmit", () => {
  it("resubmit re-enters the step it was returned from", () => {
    const result = submit(clone(), {
      applicationId: "APP-009", // returned at review
      actorId: "U-APP-2",
      at,
      idGen,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const app = result.state.applications.find((a) => a.id === "APP-009")!
    expect(app.status).toBe("submitted")
    expect(app.currentStepId).toBe(REVIEW_STEP)
    expect(result.state.events.at(-1)!.action).toBe("resubmit")
  })

  it("only the applicant can submit", () => {
    const result = submit(clone(), {
      applicationId: "APP-009",
      actorId: REVIEWER,
      at,
      idGen,
    })
    expect(result.ok).toBe(false)
  })

  it("refuses submit while answers are invalid", () => {
    const state = clone()
    const answer = state.answers.find((a) => a.id === "ANS-APP-009-1")!
    answer.value = "" // clear required full name
    const result = submit(state, {
      applicationId: "APP-009",
      actorId: "U-APP-2",
      at,
      idGen,
    })
    expect(result.ok).toBe(false)
  })
})

describe("validateAnswers", () => {
  it("passes on seeded answers", () => {
    expect(validateAnswers(SEED, "SS-P", "APP-001")).toEqual({})
  })

  it("flags required, numeric, select and file violations", () => {
    const state = clone()
    const byId = (id: string) => state.answers.find((a) => a.id === id)!
    byId("ANS-APP-001-1").value = "" // required text
    byId("ANS-APP-001-3").value = "not-a-number" // number
    byId("ANS-APP-001-4").value = "helicopter" // not an option
    byId("ANS-APP-001-6").files = [
      { name: "huge.pdf", sizeBytes: 99 * 1024 * 1024, mime: "application/pdf" },
    ] // over max size
    byId("ANS-APP-001-7").checked = false // required checkbox
    const errors = validateAnswers(state, "SS-P", "APP-001")
    expect(Object.keys(errors).sort()).toEqual(
      ["FLD-P-1", "FLD-P-3", "FLD-P-4", "FLD-P-6", "FLD-P-7"].sort()
    )
  })

  it("rejects disallowed mime types", () => {
    const state = clone()
    state.answers.find((a) => a.id === "ANS-APP-001-6")!.files = [
      { name: "essay.docx", sizeBytes: 1000, mime: "application/msword" },
    ]
    const errors = validateAnswers(state, "SS-P", "APP-001")
    expect(errors["FLD-P-6"]).toBeTruthy()
  })
})

describe("allowedActions", () => {
  it("resolves the reviewer's enabled actions at review", () => {
    const app = SEED.applications.find((a) => a.id === "APP-001")!
    const reviewer = SEED.users.find((u) => u.id === REVIEWER)!
    expect(allowedActions(SEED, app, reviewer).sort()).toEqual(
      ["approve", "reject", "return"].sort()
    )
  })

  it("is empty for non-holders of the step role and for terminal apps", () => {
    const app = SEED.applications.find((a) => a.id === "APP-001")!
    const approver = SEED.users.find((u) => u.id === APPROVER)!
    expect(allowedActions(SEED, app, approver)).toEqual([])
    const done = SEED.applications.find((a) => a.id === "APP-010")!
    const reviewer = SEED.users.find((u) => u.id === REVIEWER)!
    expect(allowedActions(SEED, done, reviewer)).toEqual([])
  })
})

describe("verify (face check gate)", () => {
  // build a draft application at the verify step
  const atVerify = (): { state: WorkflowState; appId: string } => {
    const state = clone()
    const appId = "APP-VER"
    state.applications.push({
      id: appId,
      programId: "PRG-FA",
      programVersionId: "VER-FA-1",
      applicantId: "U-APP-1",
      currentStepId: "ST-P-VER",
      status: "verifying",
      createdAt: at,
      updatedAt: at,
    })
    return { state, appId }
  }

  it("passing the face check advances to the first decision step", () => {
    const { state, appId } = atVerify()
    const result = verify(state, { applicationId: appId, actorId: "U-APP-1", passed: true, faceScore: 92, at, idGen })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const app = result.state.applications.find((a) => a.id === appId)!
    expect(app.status).toBe("submitted")
    expect(app.currentStepId).toBe(REVIEW_STEP)
    expect(result.state.verifyResults.some((r) => r.applicationId === appId && r.passed)).toBe(true)
  })

  it("a failed check keeps the applicant on the verify step", () => {
    const { state, appId } = atVerify()
    const result = verify(state, { applicationId: appId, actorId: "U-APP-1", passed: false, faceScore: 20, at, idGen })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const app = result.state.applications.find((a) => a.id === appId)!
    expect(app.status).toBe("verifying")
    expect(app.currentStepId).toBe("ST-P-VER")
  })

  it("only the applicant can complete verification", () => {
    const { state, appId } = atVerify()
    const result = verify(state, { applicationId: appId, actorId: REVIEWER, passed: true, faceScore: 92, at, idGen })
    expect(result.ok).toBe(false)
  })
})

describe("disburse", () => {
  it("releases funds on an approved application at a disbursement step", () => {
    const result = disburse(clone(), {
      applicationId: "APP-010", // approved, at disbursement (admin-assigned)
      actorId: ADMIN,
      payee: "Liza Moreno",
      amount: 10000,
      instrument: "egovpay",
      at,
      idGen,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const app = result.state.applications.find((a) => a.id === "APP-010")!
    expect(app.status).toBe("disbursed")
    expect(app.currentStepId).toBeNull()
    expect(result.state.disbursements.some((d) => d.applicationId === "APP-010")).toBe(true)
    expect(result.state.events.at(-1)!.action).toBe("disburse")
  })

  it("refuses release from the wrong role", () => {
    const result = disburse(clone(), {
      applicationId: "APP-010",
      actorId: REVIEWER,
      payee: "Liza Moreno",
      amount: 10000,
      instrument: "cash",
      at,
      idGen,
    })
    expect(result.ok).toBe(false)
  })

  it("refuses a non-positive amount", () => {
    const result = disburse(clone(), {
      applicationId: "APP-010",
      actorId: ADMIN,
      payee: "Liza Moreno",
      amount: 0,
      instrument: "cash",
      at,
      idGen,
    })
    expect(result.ok).toBe(false)
  })

  it("allows the approver to also release (separation of duties relaxed for the demo)", () => {
    // the same role/actor that approved may release — deliberate demo tradeoff
    const state = clone()
    const step = state.steps.find((s) => s.id === DISBURSE_STEP)!
    step.assignedRole = "approver"
    const result = disburse(state, {
      applicationId: "APP-010", // approved by U-APPR in the seed
      actorId: APPROVER,
      payee: "Liza Moreno",
      amount: 10000,
      instrument: "cash",
      at,
      idGen,
    })
    expect(result.ok).toBe(true)
  })
})

describe("copyStepSet", () => {
  it("copies every child collection with matching counts", () => {
    const source = "SS-T"
    const { state, stepSetId } = copyStepSet(clone(), source, idGen)
    const count = <T extends { id: string }>(
      rows: T[],
      pred: (row: T) => boolean
    ) => rows.filter(pred).length

    const srcSteps = SEED.steps.filter((s) => s.stepSetId === source)
    const newSteps = state.steps.filter((s) => s.stepSetId === stepSetId)
    expect(newSteps.length).toBe(srcSteps.length)

    const srcStepIds = srcSteps.map((s) => s.id)
    const newStepIds = newSteps.map((s) => s.id)
    expect(count(state.fields, (f) => newStepIds.includes(f.stepId))).toBe(
      count(SEED.fields, (f) => srcStepIds.includes(f.stepId))
    )
    expect(count(state.stepActions, (a) => newStepIds.includes(a.stepId))).toBe(
      count(SEED.stepActions, (a) => srcStepIds.includes(a.stepId))
    )

    const srcFieldIds = SEED.fields.filter((f) => srcStepIds.includes(f.stepId)).map((f) => f.id)
    const newFieldIds = state.fields.filter((f) => newStepIds.includes(f.stepId)).map((f) => f.id)
    expect(count(state.options, (o) => newFieldIds.includes(o.fieldId))).toBe(
      count(SEED.options, (o) => srcFieldIds.includes(o.fieldId))
    )
    expect(count(state.fileRules, (r) => newFieldIds.includes(r.fieldId))).toBe(
      count(SEED.fileRules, (r) => srcFieldIds.includes(r.fieldId))
    )

    const srcActionIds = SEED.stepActions.filter((a) => srcStepIds.includes(a.stepId)).map((a) => a.id)
    const newActionIds = state.stepActions.filter((a) => newStepIds.includes(a.stepId)).map((a) => a.id)
    expect(count(state.reasonCodes, (r) => newActionIds.includes(r.stepActionId))).toBe(
      count(SEED.reasonCodes, (r) => srcActionIds.includes(r.stepActionId))
    )
  })

  it("copies are independent — mutating the copy leaves the source intact", () => {
    const { state, stepSetId } = copyStepSet(clone(), "SS-T", idGen)
    const copiedStep = state.steps.find((s) => s.stepSetId === stepSetId)!
    copiedStep.name = "Renamed in copy"
    const sourceSteps = state.steps.filter((s) => s.stepSetId === "SS-T")
    expect(sourceSteps.some((s) => s.name === "Renamed in copy")).toBe(false)
  })
})

describe("seed integrity", () => {
  it("queues match the spec: ≥6 at review, ≥2 at second review, ≥1 each terminal/returned", () => {
    const atStep = (stepId: string) =>
      SEED.applications.filter((a) => a.status === "submitted" && a.currentStepId === stepId)
    expect(atStep(REVIEW_STEP).length).toBeGreaterThanOrEqual(6)
    expect(atStep(SECOND_REVIEW_STEP).length).toBeGreaterThanOrEqual(2)
    expect(SEED.applications.filter((a) => a.status === "returned").length).toBeGreaterThanOrEqual(1)
    expect(SEED.applications.filter((a) => a.status === "approved").length).toBeGreaterThanOrEqual(1)
    expect(SEED.applications.filter((a) => a.status === "rejected").length).toBeGreaterThanOrEqual(1)
    expect(SEED.applications.length).toBeGreaterThanOrEqual(12)
  })

  it("every application has a coherent event history and valid answers", () => {
    for (const app of SEED.applications) {
      const events = SEED.events.filter((e) => e.applicationId === app.id)
      expect(events.length).toBeGreaterThan(0)
      expect(events[0].action).toBe("submit")
      const version = SEED.versions.find((v) => v.id === app.programVersionId)!
      expect(validateAnswers(SEED, version.stepSetId, app.id)).toEqual({})
    }
  })
})

describe("4Ps review checklist", () => {
  const REVIEW = "ST-F-REV"
  const SW = "U-SW"
  const APP = "FPS-001" // submitted, at 4Ps review

  function verifyAll(state: WorkflowState, appId: string): WorkflowState {
    const version = state.versions.find((v) => v.id === state.applications.find((a) => a.id === appId)!.programVersionId)!
    const items = reviewItemsOf(state, appId, version.stepSetId)
    return {
      ...state,
      reviewChecks: [
        ...state.reviewChecks,
        ...items.map((it, i) => ({
          id: `RCK-T-${i}`,
          applicationId: appId,
          stepId: REVIEW,
          itemKey: it.key,
          verdict: "approved" as const,
          checkedBy: SW,
          at,
        })),
      ],
    }
  }

  it("derives one item per answered field and per uploaded document", () => {
    const items = reviewItemsOf(SEED, APP, "SS-F")
    // AICS form: 5 text/select/textarea answers (name, type, id, amount, nature)
    // + checkbox (checked) + 3 files (valid ID, support doc, barangay cert) = 9
    expect(items.length).toBe(9)
    expect(items.filter((i) => i.kind === "file").length).toBe(3)
    // real values surfaced, not placeholders
    expect(items.some((i) => i.value === "Maria Reyes")).toBe(true)
  })

  it("refuses approve until every item is verified", () => {
    const result = decide(clone(), {
      applicationId: APP,
      action: "approve",
      actorId: SW,
      at,
      idGen,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain("Verify all items")
  })

  it("allows approve once all items verified → advances to disbursement", () => {
    const state = verifyAll(clone(), APP)
    const progress = reviewProgress(
      state,
      state.applications.find((a) => a.id === APP)!,
      state.steps.find((s) => s.id === REVIEW)!
    )
    expect(progress.complete).toBe(true)
    const result = decide(state, { applicationId: APP, action: "approve", actorId: SW, at, idGen })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const app = result.state.applications.find((a) => a.id === APP)!
    expect(app.status).toBe("approved")
    expect(app.currentStepId).toBe("ST-F-DSB")
  })

  it("does not gate return even with items unverified", () => {
    const result = decide(clone(), {
      applicationId: APP,
      action: "return",
      actorId: SW,
      reasonCodeId: "RC-F-RET-1",
      comment: "Please re-upload a clearer barangay certificate.",
      at,
      idGen,
    })
    expect(result.ok).toBe(true)
  })

  it("refuses approve from a non-social-worker", () => {
    const state = verifyAll(clone(), APP)
    const result = decide(state, { applicationId: APP, action: "approve", actorId: REVIEWER, at, idGen })
    expect(result.ok).toBe(false)
  })
})
