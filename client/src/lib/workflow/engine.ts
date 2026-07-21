import type {
  Answer,
  AppUser,
  DecisionAction,
  DisbursementInstrument,
  FieldOption,
  FileMeta,
  FileRule,
  FormField,
  ReasonCode,
  Step,
  StepAction,
  WorkflowApplication,
  WorkflowState,
} from "./types"

// ---------------------------------------------------------------------------
// Pure rules module. No UI, no storage — the store calls into this, and this
// is the code that moves server-side unchanged once a backend exists.
// ---------------------------------------------------------------------------

export type EngineResult =
  | { ok: true; state: WorkflowState }
  | { ok: false; error: string }

export type IdGen = (prefix: string) => string

// ---- selectors -------------------------------------------------------------

export function stepsOf(state: WorkflowState, stepSetId: string): Step[] {
  return state.steps
    .filter((s) => s.stepSetId === stepSetId)
    .sort((a, b) => a.position - b.position)
}

export function fieldsOf(state: WorkflowState, stepId: string): FormField[] {
  return state.fields
    .filter((f) => f.stepId === stepId)
    .sort((a, b) => a.position - b.position)
}

export function optionsOf(state: WorkflowState, fieldId: string): FieldOption[] {
  return state.options
    .filter((o) => o.fieldId === fieldId)
    .sort((a, b) => a.position - b.position)
}

export function fileRuleOf(state: WorkflowState, fieldId: string): FileRule | undefined {
  return state.fileRules.find((r) => r.fieldId === fieldId)
}

export function actionsOf(state: WorkflowState, stepId: string): StepAction[] {
  return state.stepActions.filter((a) => a.stepId === stepId)
}

export function reasonCodesOf(state: WorkflowState, stepActionId: string): ReasonCode[] {
  return state.reasonCodes
    .filter((r) => r.stepActionId === stepActionId)
    .sort((a, b) => a.position - b.position)
}

export function isDecisionStep(step: Step): boolean {
  return step.type === "review"
}

export function decisionStepsOf(state: WorkflowState, stepSetId: string): Step[] {
  return stepsOf(state, stepSetId).filter(isDecisionStep)
}

/** Steps the applicant clears in order before entering the first review queue. */
export function applicantStepsOf(state: WorkflowState, stepSetId: string): Step[] {
  return stepsOf(state, stepSetId).filter(
    (s) => s.type === "form" || s.type === "verify"
  )
}

export function disbursementStepsOf(state: WorkflowState, stepSetId: string): Step[] {
  return stepsOf(state, stepSetId).filter((s) => s.type === "disbursement")
}

export function verifyResultFor(
  state: WorkflowState,
  applicationId: string,
  stepId: string
) {
  return state.verifyResults.find(
    (r) => r.applicationId === applicationId && r.stepId === stepId
  )
}

/** First verify step the applicant has not yet passed, in order. */
export function pendingVerifyStep(
  state: WorkflowState,
  stepSetId: string,
  applicationId: string
): Step | null {
  for (const step of stepsOf(state, stepSetId)) {
    if (step.type !== "verify") continue
    const result = verifyResultFor(state, applicationId, step.id)
    if (!result?.passed) return step
  }
  return null
}

export function formFieldsOfStepSet(state: WorkflowState, stepSetId: string): FormField[] {
  return stepsOf(state, stepSetId)
    .filter((s) => s.type === "form")
    .flatMap((s) => fieldsOf(state, s.id))
}

export function answerFor(
  state: WorkflowState,
  applicationId: string,
  fieldId: string
): Answer | undefined {
  return state.answers.find(
    (a) => a.applicationId === applicationId && a.fieldId === fieldId
  )
}

// ---- validation ------------------------------------------------------------

export function validateFiles(rule: FileRule | undefined, files: FileMeta[]): string | null {
  if (!rule) return null
  if (files.length < rule.minCount)
    return `At least ${rule.minCount} file${rule.minCount > 1 ? "s" : ""} required`
  if (files.length > rule.maxCount)
    return `At most ${rule.maxCount} file${rule.maxCount > 1 ? "s" : ""} allowed`
  for (const f of files) {
    if (rule.allowedMime.length > 0 && !rule.allowedMime.includes(f.mime))
      return `"${f.name}" is not an allowed format (${rule.allowedMime.join(", ")})`
    if (f.sizeBytes > rule.maxSizeMb * 1024 * 1024)
      return `"${f.name}" exceeds the ${rule.maxSizeMb} MB limit`
  }
  return null
}

/** Field-level errors keyed by field id. Empty object = valid. */
export function validateAnswers(
  state: WorkflowState,
  stepSetId: string,
  applicationId: string
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of formFieldsOfStepSet(state, stepSetId)) {
    const answer = answerFor(state, applicationId, field.id)
    const value = answer?.value?.trim() ?? ""

    if (field.type === "checkbox") {
      if (field.required && !answer?.checked) errors[field.id] = "Required"
      continue
    }
    if (field.type === "file") {
      const files = answer?.files ?? []
      const rule = fileRuleOf(state, field.id)
      if (field.required && files.length === 0 && (rule?.minCount ?? 1) > 0) {
        errors[field.id] = "Required"
        continue
      }
      if (files.length > 0 || field.required) {
        const err = validateFiles(rule, files)
        if (err) errors[field.id] = err
      }
      continue
    }
    if (field.required && value === "") {
      errors[field.id] = "Required"
      continue
    }
    if (value === "") continue
    if (field.type === "number" && Number.isNaN(Number(value)))
      errors[field.id] = "Must be a number"
    if (field.type === "date" && Number.isNaN(new Date(value).getTime()))
      errors[field.id] = "Must be a valid date"
    if (field.type === "select") {
      const opts = optionsOf(state, field.id)
      if (!opts.some((o) => o.value === value))
        errors[field.id] = "Must be one of the offered options"
    }
  }
  return errors
}

// ---- action resolution -----------------------------------------------------

/** Actions the given user may take on the application right now. */
export function allowedActions(
  state: WorkflowState,
  app: WorkflowApplication,
  user: AppUser
): DecisionAction[] {
  if (app.status !== "submitted" || !app.currentStepId) return []
  const step = state.steps.find((s) => s.id === app.currentStepId)
  if (!step || !isDecisionStep(step)) return []
  if (!step.assignedRole || !user.roles.includes(step.assignedRole)) return []
  return actionsOf(state, step.id)
    .filter((a) => a.enabled)
    .map((a) => a.action)
}

// ---- transitions -----------------------------------------------------------

interface SubmitInput {
  applicationId: string
  actorId: string
  at: string
  idGen: IdGen
}

/** Submit a draft, or resubmit a returned application (re-enters the same step). */
export function submit(state: WorkflowState, input: SubmitInput): EngineResult {
  const app = state.applications.find((a) => a.id === input.applicationId)
  if (!app) return { ok: false, error: "Application not found" }
  if (app.status !== "draft" && app.status !== "returned")
    return { ok: false, error: `Cannot submit an application in status "${app.status}"` }
  if (app.applicantId !== input.actorId)
    return { ok: false, error: "Only the applicant can submit this application" }

  const version = state.versions.find((v) => v.id === app.programVersionId)
  if (!version) return { ok: false, error: "Program version not found" }

  const errors = validateAnswers(state, version.stepSetId, app.id)
  if (Object.keys(errors).length > 0)
    return { ok: false, error: "Answers have validation errors" }

  const isResubmit = app.status === "returned"
  if (isResubmit) {
    // resubmit re-enters the step it was returned from (§2.10)
    const target = state.steps.find((s) => s.id === app.currentStepId) ?? null
    if (!target) return { ok: false, error: "Return step no longer exists" }
    return {
      ok: true,
      state: withEvent(
        {
          ...state,
          applications: state.applications.map((a) =>
            a.id === app.id
              ? { ...a, status: "submitted", currentStepId: target.id, updatedAt: input.at }
              : a
          ),
        },
        event(input, app.id, "resubmit", null, target.id)
      ),
    }
  }

  // first submit: clear any verify steps before entering the review queue
  const verify = pendingVerifyStep(state, version.stepSetId, app.id)
  if (verify) {
    return {
      ok: true,
      state: withEvent(
        {
          ...state,
          applications: state.applications.map((a) =>
            a.id === app.id
              ? { ...a, status: "verifying", currentStepId: verify.id, updatedAt: input.at }
              : a
          ),
        },
        event(input, app.id, "submit", null, verify.id)
      ),
    }
  }

  const target = decisionStepsOf(state, version.stepSetId)[0] ?? null
  if (!target)
    return { ok: false, error: "Workflow has no review step" }
  return {
    ok: true,
    state: withEvent(
      {
        ...state,
        applications: state.applications.map((a) =>
          a.id === app.id
            ? { ...a, status: "submitted", currentStepId: target.id, updatedAt: input.at }
            : a
        ),
      },
      event(input, app.id, "submit", null, target.id)
    ),
  }
}

interface VerifyInput {
  applicationId: string
  actorId: string
  passed: boolean
  faceScore: number
  at: string
  idGen: IdGen
}

/**
 * Applicant clears a verify step (mock face check). On pass, advance to the
 * next pending verify or the first decision step. No real eVerify call.
 */
export function verify(state: WorkflowState, input: VerifyInput): EngineResult {
  const app = state.applications.find((a) => a.id === input.applicationId)
  if (!app) return { ok: false, error: "Application not found" }
  if (app.applicantId !== input.actorId)
    return { ok: false, error: "Only the applicant can complete identity verification" }
  if (app.status !== "verifying" || !app.currentStepId)
    return { ok: false, error: "Application is not awaiting identity verification" }
  const step = state.steps.find((s) => s.id === app.currentStepId)
  if (!step || step.type !== "verify")
    return { ok: false, error: "Current step is not a verify step" }

  const withResult: WorkflowState = {
    ...state,
    verifyResults: [
      ...state.verifyResults,
      {
        id: input.idGen("VR"),
        applicationId: app.id,
        stepId: step.id,
        passed: input.passed,
        faceScore: input.faceScore,
        at: input.at,
      },
    ],
  }

  if (!input.passed) {
    // stays on the verify step; applicant retries
    return { ok: true, state: withResult }
  }

  const nextVerify = pendingVerifyStep(withResult, step.stepSetId, app.id)
  const target = nextVerify ?? decisionStepsOf(withResult, step.stepSetId)[0] ?? null
  if (!target) return { ok: false, error: "Workflow has no review step" }
  const enteringDecision = target.type !== "verify"

  return {
    ok: true,
    state: withEvent(
      {
        ...withResult,
        applications: withResult.applications.map((a) =>
          a.id === app.id
            ? {
                ...a,
                status: enteringDecision ? "submitted" : "verifying",
                currentStepId: target.id,
                updatedAt: input.at,
              }
            : a
        ),
      },
      {
        id: input.idGen("EVT"),
        applicationId: app.id,
        actorId: input.actorId,
        action: "verify",
        fromStepId: step.id,
        toStepId: target.id,
        reasonCodeId: null,
        comment: `Face check passed (${Math.round(input.faceScore)}%)`,
        at: input.at,
      }
    ),
  }
}

interface DisburseInput {
  applicationId: string
  actorId: string
  payee: string
  amount: number
  instrument: DisbursementInstrument
  at: string
  idGen: IdGen
}

/** Release money on a disbursement step → application becomes `disbursed`. */
export function disburse(state: WorkflowState, input: DisburseInput): EngineResult {
  const app = state.applications.find((a) => a.id === input.applicationId)
  if (!app) return { ok: false, error: "Application not found" }
  const actor = state.users.find((u) => u.id === input.actorId)
  if (!actor) return { ok: false, error: "Acting user not found" }
  if (app.status !== "approved" || !app.currentStepId)
    return { ok: false, error: "Only an approved application at a disbursement step can be released" }
  const step = state.steps.find((s) => s.id === app.currentStepId)
  if (!step || step.type !== "disbursement")
    return { ok: false, error: "Current step is not a disbursement step" }
  if (!step.assignedRole || !actor.roles.includes(step.assignedRole))
    return { ok: false, error: `Only a ${step.assignedRole ?? "qualified"} can release funds` }
  // separation of duties: the approver of this application cannot also release it
  const approvedBy = state.events.find(
    (e) => e.applicationId === app.id && e.action === "approve" && e.toStepId === step.id
  )
  if (approvedBy && approvedBy.actorId === input.actorId)
    return { ok: false, error: "Separation of duties — the approver cannot release the funds" }
  if (!input.payee.trim()) return { ok: false, error: "Payee is required" }
  if (!(input.amount > 0)) return { ok: false, error: "Amount must be greater than zero" }

  return {
    ok: true,
    state: withEvent(
      {
        ...state,
        disbursements: [
          ...state.disbursements,
          {
            id: input.idGen("DSB"),
            applicationId: app.id,
            stepId: step.id,
            payee: input.payee.trim(),
            amount: input.amount,
            instrument: input.instrument,
            releasedBy: input.actorId,
            at: input.at,
          },
        ],
        applications: state.applications.map((a) =>
          a.id === app.id
            ? { ...a, status: "disbursed", currentStepId: null, updatedAt: input.at }
            : a
        ),
      },
      {
        id: input.idGen("EVT"),
        applicationId: app.id,
        actorId: input.actorId,
        action: "disburse",
        fromStepId: step.id,
        toStepId: null,
        reasonCodeId: null,
        comment: `Released ₱${input.amount.toLocaleString()} to ${input.payee.trim()}`,
        at: input.at,
      }
    ),
  }
}

function event(
  input: { idGen: IdGen; actorId: string; at: string },
  applicationId: string,
  action: "submit" | "resubmit",
  fromStepId: string | null,
  toStepId: string | null
) {
  return {
    id: input.idGen("EVT"),
    applicationId,
    actorId: input.actorId,
    action,
    fromStepId,
    toStepId,
    reasonCodeId: null,
    comment: null,
    at: input.at,
  }
}

export interface DecisionInput {
  applicationId: string
  action: DecisionAction
  actorId: string
  reasonCodeId?: string
  comment?: string
  at: string
  idGen: IdGen
}

/**
 * Human decision on a decision step. Every guard lives here:
 * terminal state, human lock, role, enabled action, comment, reason code.
 */
export function decide(state: WorkflowState, input: DecisionInput): EngineResult {
  const app = state.applications.find((a) => a.id === input.applicationId)
  if (!app) return { ok: false, error: "Application not found" }
  const actor = state.users.find((u) => u.id === input.actorId)
  if (!actor) return { ok: false, error: "Acting user not found" }

  if (app.status === "approved" || app.status === "rejected" || app.status === "disbursed")
    return { ok: false, error: `Application is already ${app.status} — no further decisions` }
  if (app.status !== "submitted" || !app.currentStepId)
    return { ok: false, error: "Application is not waiting at a decision step" }

  const step = state.steps.find((s) => s.id === app.currentStepId)
  if (!step || !isDecisionStep(step))
    return { ok: false, error: "Current step does not accept decisions" }
  if (!step.assignedRole || !actor.roles.includes(step.assignedRole))
    return { ok: false, error: `Only a ${step.assignedRole ?? "qualified"} can act on this step` }

  const stepAction = actionsOf(state, step.id).find((a) => a.action === input.action)
  if (!stepAction || !stepAction.enabled)
    return { ok: false, error: `"${input.action}" is not enabled on this step` }

  const comment = input.comment?.trim() ?? ""
  if (stepAction.commentRequired && comment === "")
    return { ok: false, error: "A comment is required for this action" }

  let reasonCodeId: string | null = null
  if (input.action === "return" || input.action === "reject") {
    const codes = reasonCodesOf(state, stepAction.id)
    if (codes.length > 0) {
      const match = codes.find((c) => c.id === input.reasonCodeId)
      if (!match) return { ok: false, error: "A reason code is required for this action" }
      reasonCodeId = match.id
    }
  }

  let next: Partial<WorkflowApplication>
  let toStepId: string | null = null
  if (input.action === "approve") {
    const decisions = decisionStepsOf(state, step.stepSetId)
    const idx = decisions.findIndex((s) => s.id === step.id)
    const nextDecision = decisions[idx + 1] ?? null
    if (nextDecision) {
      toStepId = nextDecision.id
      next = { currentStepId: nextDecision.id, status: "submitted" }
    } else {
      // last decision cleared → disbursement step if the workflow has one,
      // otherwise the application is approved and done
      const disbursement = disbursementStepsOf(state, step.stepSetId)[0] ?? null
      toStepId = disbursement?.id ?? null
      next = { currentStepId: disbursement?.id ?? null, status: "approved" }
    }
  } else if (input.action === "return") {
    // stays pinned to this step; applicant resubmits back into it
    toStepId = step.id
    next = { status: "returned" }
  } else {
    next = { status: "rejected" }
  }

  return {
    ok: true,
    state: withEvent(
      {
        ...state,
        applications: state.applications.map((a) =>
          a.id === app.id ? { ...a, ...next, updatedAt: input.at } : a
        ),
      },
      {
        id: input.idGen("EVT"),
        applicationId: app.id,
        actorId: input.actorId,
        action: input.action,
        fromStepId: step.id,
        toStepId,
        reasonCodeId,
        comment: comment || null,
        at: input.at,
      }
    ),
  }
}

/** Append-only: events are only ever added, never mutated or removed. */
function withEvent(
  state: WorkflowState,
  event: WorkflowState["events"][number]
): WorkflowState {
  return { ...state, events: [...state.events, event] }
}

// ---- deep copy (apply template / new draft version) ------------------------

/**
 * Deep-copies a step set with all children: steps → fields → options →
 * file rules → step actions → reason codes. Returns the grown state and the
 * new step set id. Copies are fully independent of the source.
 */
export function copyStepSet(
  state: WorkflowState,
  sourceStepSetId: string,
  idGen: IdGen
): { state: WorkflowState; stepSetId: string } {
  const stepSetId = idGen("SS")
  const next: WorkflowState = {
    ...state,
    stepSets: [...state.stepSets, { id: stepSetId }],
    steps: [...state.steps],
    fields: [...state.fields],
    options: [...state.options],
    fileRules: [...state.fileRules],
    stepActions: [...state.stepActions],
    reasonCodes: [...state.reasonCodes],
  }

  for (const step of stepsOf(state, sourceStepSetId)) {
    const newStepId = idGen("ST")
    next.steps.push({
      ...step,
      id: newStepId,
      stepSetId,
      verifyConfig: step.verifyConfig ? { ...step.verifyConfig } : undefined,
    })

    for (const field of fieldsOf(state, step.id)) {
      const newFieldId = idGen("FLD")
      next.fields.push({ ...field, id: newFieldId, stepId: newStepId })
      for (const opt of optionsOf(state, field.id))
        next.options.push({ ...opt, id: idGen("OPT"), fieldId: newFieldId })
      const rule = fileRuleOf(state, field.id)
      if (rule)
        next.fileRules.push({
          ...rule,
          id: idGen("FR"),
          fieldId: newFieldId,
          allowedMime: [...rule.allowedMime],
        })
    }

    for (const action of actionsOf(state, step.id)) {
      const newActionId = idGen("ACT")
      next.stepActions.push({ ...action, id: newActionId, stepId: newStepId })
      for (const code of reasonCodesOf(state, action.id))
        next.reasonCodes.push({ ...code, id: idGen("RC"), stepActionId: newActionId })
    }
  }

  return { state: next, stepSetId }
}
