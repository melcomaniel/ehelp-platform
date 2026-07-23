"use client"

import * as React from "react"

import {
  addComment,
  allowedActions,
  copyStepSet,
  decide,
  decisionStepsOf,
  disburse,
  stepsOf,
  submit,
  validateAnswers,
  verify,
  type DecisionInput,
} from "./engine"
import { SEED } from "./seed"
import type {
  Answer,
  AppUser,
  Classification,
  DecisionAction,
  DisbursementInstrument,
  FieldType,
  FileRule,
  FormField,
  ReasonCode,
  RoleKey,
  StepType,
  VerifyConfig,
  WorkflowApplication,
  WorkflowState,
} from "./types"

// Bump the version whenever the seed shape changes so stale localStorage
// (missing new programs/steps) is discarded and fresh fixtures load.
const STORAGE_KEY = "workflow-engine-state-v7"

export type MutationResult = { ok: true; id?: string } | { ok: false; error: string }

let counter = 0
function nextId(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${counter}`
}

const now = () => new Date().toISOString()

interface WorkflowStore {
  state: WorkflowState
  hydrated: boolean
  actingUser: AppUser
  hasRole: (role: RoleKey) => boolean
  setActingUser: (id: string) => void
  resetAll: () => void

  // template library
  createTemplate: (name: string, description: string) => MutationResult
  updateTemplate: (id: string, patch: { name?: string; description?: string }) => MutationResult
  publishTemplate: (id: string) => MutationResult
  archiveTemplate: (id: string) => MutationResult

  // step-set builder (templates and program draft versions)
  addStep: (stepSetId: string, type: StepType) => MutationResult
  updateStep: (stepId: string, patch: { name?: string; assignedRole?: RoleKey }) => MutationResult
  moveStep: (stepId: string, dir: -1 | 1) => MutationResult
  removeStep: (stepId: string) => MutationResult
  addField: (stepId: string, type: FieldType) => MutationResult
  updateField: (fieldId: string, patch: Partial<Pick<FormField, "label" | "helpText" | "required">>) => MutationResult
  moveField: (fieldId: string, dir: -1 | 1) => MutationResult
  removeField: (fieldId: string) => MutationResult
  addOption: (fieldId: string) => MutationResult
  updateOption: (optionId: string, patch: { value?: string; label?: string }) => MutationResult
  removeOption: (optionId: string) => MutationResult
  updateFileRule: (fieldId: string, patch: Partial<Omit<FileRule, "id" | "fieldId">>) => MutationResult
  setActionEnabled: (stepActionId: string, enabled: boolean) => MutationResult
  setActionCommentRequired: (stepActionId: string, required: boolean) => MutationResult
  addReasonCode: (stepActionId: string, code: string, label: string) => MutationResult
  removeReasonCode: (reasonCodeId: string) => MutationResult
  updateVerifyConfig: (stepId: string, patch: Partial<VerifyConfig>) => MutationResult

  // programs
  createProgram: (input: {
    name: string
    description: string
    classification: Classification
    templateId: string | null
  }) => MutationResult
  publishVersion: (versionId: string) => MutationResult
  createDraftFromPublished: (programId: string) => MutationResult

  // applications
  startApplication: (programId: string) => MutationResult
  setAnswer: (applicationId: string, fieldId: string, patch: Partial<Pick<Answer, "value" | "checked" | "files">>) => MutationResult
  validate: (applicationId: string) => Record<string, string>
  submitApplication: (applicationId: string) => MutationResult
  decideApplication: (input: Omit<DecisionInput, "actorId" | "at" | "idGen">) => MutationResult
  verifyApplication: (applicationId: string, passed: boolean, faceScore: number) => MutationResult
  disburseApplication: (input: {
    applicationId: string
    payee: string
    amount: number
    instrument: DisbursementInstrument
  }) => MutationResult
  allowedActionsFor: (app: WorkflowApplication) => DecisionAction[]
  /** Set (or clear, by clicking the same verdict again) the reviewer's verdict on one checklist item. */
  setReviewVerdict: (
    applicationId: string,
    stepId: string,
    itemKey: string,
    verdict: "approved" | "rejected"
  ) => MutationResult
  /** General comment on an application (audit event, no transition). */
  commentOnApplication: (applicationId: string, comment: string) => MutationResult
}

const StoreContext = React.createContext<WorkflowStore | null>(null)

/**
 * A step set is editable only while its owner is: templates unless archived
 * (templates are versionless — edits change what future applies copy),
 * program versions only while draft (§ publish = freeze).
 */
function editableError(state: WorkflowState, stepSetId: string): string | null {
  const template = state.templates.find((t) => t.stepSetId === stepSetId)
  if (template)
    return template.status === "archived" ? "Archived templates are read-only" : null
  const version = state.versions.find((v) => v.stepSetId === stepSetId)
  if (version)
    return version.status !== "draft" ? "Published versions are frozen — create a new draft to edit" : null
  return "Step set has no owner"
}

function defaultDecisionActions(state: WorkflowState, stepId: string): WorkflowState {
  const mk = (action: DecisionAction, commentRequired: boolean) => ({
    id: nextId("ACT"),
    stepId,
    action,
    enabled: true,
    commentRequired,
  })
  return {
    ...state,
    stepActions: [
      ...state.stepActions,
      mk("approve", false),
      mk("return", true),
      mk("reject", true),
    ],
  }
}

export function WorkflowProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<WorkflowState>(SEED)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw) setState(JSON.parse(raw) as WorkflowState)
      } catch {
        // corrupted local state falls back to fixtures
      }
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state, hydrated])

  const store = React.useMemo<WorkflowStore>(() => {
    const actingUser =
      state.users.find((u) => u.id === state.actingUserId) ?? state.users[0]

    /** Runs a guarded pure mutation; returns its result and commits on ok. */
    const apply = (fn: (prev: WorkflowState) => { state: WorkflowState } | { error: string }, id?: string): MutationResult => {
      const out = fn(state)
      if ("error" in out) return { ok: false, error: out.error }
      setState(out.state)
      return { ok: true, id }
    }

    const editStepSetOf = (
      entityStepSetId: string,
      fn: (prev: WorkflowState) => WorkflowState
    ): MutationResult =>
      apply((prev) => {
        const err = editableError(prev, entityStepSetId)
        return err ? { error: err } : { state: fn(prev) }
      })

    const stepSetIdOfStep = (stepId: string) =>
      state.steps.find((s) => s.id === stepId)?.stepSetId

    const stepSetIdOfField = (fieldId: string) => {
      const field = state.fields.find((f) => f.id === fieldId)
      return field ? stepSetIdOfStep(field.stepId) : undefined
    }

    const stepSetIdOfAction = (stepActionId: string) => {
      const action = state.stepActions.find((a) => a.id === stepActionId)
      return action ? stepSetIdOfStep(action.stepId) : undefined
    }

    return {
      state,
      hydrated,
      actingUser,
      hasRole: (role) => actingUser.roles.includes(role),

      setActingUser: (id) =>
        setState((prev) => ({ ...prev, actingUserId: id })),

      resetAll: () => {
        window.localStorage.removeItem(STORAGE_KEY)
        setState(SEED)
      },

      // ---- template library ------------------------------------------------

      createTemplate: (name, description) => {
        if (!name.trim()) return { ok: false, error: "Template name is required" }
        const stepSetId = nextId("SS")
        const id = nextId("TPL")
        setState((prev) => ({
          ...prev,
          stepSets: [...prev.stepSets, { id: stepSetId }],
          templates: [
            ...prev.templates,
            { id, name: name.trim(), description: description.trim(), status: "draft", stepSetId },
          ],
        }))
        return { ok: true, id }
      },

      updateTemplate: (id, patch) =>
        apply((prev) => {
          const t = prev.templates.find((x) => x.id === id)
          if (!t) return { error: "Template not found" }
          if (t.status === "archived") return { error: "Archived templates are read-only" }
          return {
            state: {
              ...prev,
              templates: prev.templates.map((x) => (x.id === id ? { ...x, ...patch } : x)),
            },
          }
        }),

      publishTemplate: (id) =>
        apply((prev) => {
          const t = prev.templates.find((x) => x.id === id)
          if (!t) return { error: "Template not found" }
          if (t.status === "archived") return { error: "Archived templates cannot be published" }
          if (decisionStepsOf(prev, t.stepSetId).length === 0)
            return { error: "Add at least one review step before publishing" }
          return {
            state: {
              ...prev,
              templates: prev.templates.map((x) =>
                x.id === id ? { ...x, status: "published" } : x
              ),
            },
          }
        }),

      archiveTemplate: (id) =>
        apply((prev) => ({
          state: {
            ...prev,
            templates: prev.templates.map((x) =>
              x.id === id ? { ...x, status: "archived" } : x
            ),
          },
        })),

      // ---- builder -----------------------------------------------------------

      addStep: (stepSetId, type) =>
        editStepSetOf(stepSetId, (prev) => {
          const position = stepsOf(prev, stepSetId).length + 1
          const stepId = nextId("ST")
          const named: Record<StepType, string> = {
            form: "Application Form",
            verify: "Face Verification",
            review: "Review",
            disbursement: "Disbursement",
          }
          const assignedRole: RoleKey | null =
            type === "review"
              ? "reviewer"
              : type === "disbursement"
                ? "approver"
                : null
          const base: WorkflowState = {
            ...prev,
            steps: [
              ...prev.steps,
              {
                id: stepId,
                stepSetId,
                position,
                type,
                name: named[type],
                assignedRole,
                // §2.1 hard lock: decision steps never auto-advance
                autoAdvance: type === "form",
                verifyConfig:
                  type === "verify"
                    ? { provider: "eVerify", faceLiveness: true, philsysMatch: false }
                    : undefined,
              },
            ],
          }
          return type === "review" ? defaultDecisionActions(base, stepId) : base
        }),

      updateStep: (stepId, patch) => {
        const ssId = stepSetIdOfStep(stepId)
        if (!ssId) return { ok: false, error: "Step not found" }
        return editStepSetOf(ssId, (prev) => ({
          ...prev,
          steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
        }))
      },

      moveStep: (stepId, dir) => {
        const ssId = stepSetIdOfStep(stepId)
        if (!ssId) return { ok: false, error: "Step not found" }
        return editStepSetOf(ssId, (prev) => {
          const ordered = stepsOf(prev, ssId)
          const idx = ordered.findIndex((s) => s.id === stepId)
          const target = ordered[idx + dir]
          if (!target) return prev
          return {
            ...prev,
            steps: prev.steps.map((s) => {
              if (s.id === stepId) return { ...s, position: target.position }
              if (s.id === target.id) return { ...s, position: ordered[idx].position }
              return s
            }),
          }
        })
      },

      removeStep: (stepId) => {
        const ssId = stepSetIdOfStep(stepId)
        if (!ssId) return { ok: false, error: "Step not found" }
        return editStepSetOf(ssId, (prev) => {
          const fieldIds = prev.fields.filter((f) => f.stepId === stepId).map((f) => f.id)
          const actionIds = prev.stepActions.filter((a) => a.stepId === stepId).map((a) => a.id)
          return {
            ...prev,
            steps: prev.steps.filter((s) => s.id !== stepId),
            fields: prev.fields.filter((f) => f.stepId !== stepId),
            options: prev.options.filter((o) => !fieldIds.includes(o.fieldId)),
            fileRules: prev.fileRules.filter((r) => !fieldIds.includes(r.fieldId)),
            stepActions: prev.stepActions.filter((a) => a.stepId !== stepId),
            reasonCodes: prev.reasonCodes.filter((r) => !actionIds.includes(r.stepActionId)),
          }
        })
      },

      addField: (stepId, type) => {
        const ssId = stepSetIdOfStep(stepId)
        if (!ssId) return { ok: false, error: "Step not found" }
        return editStepSetOf(ssId, (prev) => {
          const fieldId = nextId("FLD")
          const position = prev.fields.filter((f) => f.stepId === stepId).length + 1
          const labels: Record<FieldType, string> = {
            text: "Text field",
            textarea: "Long text field",
            number: "Number field",
            date: "Date field",
            select: "Choice field",
            checkbox: "Checkbox",
            file: "File upload",
          }
          let next: WorkflowState = {
            ...prev,
            fields: [
              ...prev.fields,
              { id: fieldId, stepId, position, type, label: labels[type], helpText: "", required: false },
            ],
          }
          if (type === "select")
            next = {
              ...next,
              options: [
                ...next.options,
                { id: nextId("OPT"), fieldId, position: 1, value: "option-1", label: "Option 1" },
                { id: nextId("OPT"), fieldId, position: 2, value: "option-2", label: "Option 2" },
              ],
            }
          if (type === "file")
            next = {
              ...next,
              fileRules: [
                ...next.fileRules,
                { id: nextId("FR"), fieldId, allowedMime: ["application/pdf", "image/jpeg", "image/png"], maxSizeMb: 5, minCount: 1, maxCount: 3 },
              ],
            }
          return next
        })
      },

      updateField: (fieldId, patch) => {
        const ssId = stepSetIdOfField(fieldId)
        if (!ssId) return { ok: false, error: "Field not found" }
        return editStepSetOf(ssId, (prev) => ({
          ...prev,
          fields: prev.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)),
        }))
      },

      moveField: (fieldId, dir) => {
        const ssId = stepSetIdOfField(fieldId)
        if (!ssId) return { ok: false, error: "Field not found" }
        return editStepSetOf(ssId, (prev) => {
          const field = prev.fields.find((f) => f.id === fieldId)
          if (!field) return prev
          const siblings = prev.fields
            .filter((f) => f.stepId === field.stepId)
            .sort((a, b) => a.position - b.position)
          const idx = siblings.findIndex((f) => f.id === fieldId)
          const target = siblings[idx + dir]
          if (!target) return prev
          return {
            ...prev,
            fields: prev.fields.map((f) => {
              if (f.id === fieldId) return { ...f, position: target.position }
              if (f.id === target.id) return { ...f, position: field.position }
              return f
            }),
          }
        })
      },

      removeField: (fieldId) => {
        const ssId = stepSetIdOfField(fieldId)
        if (!ssId) return { ok: false, error: "Field not found" }
        return editStepSetOf(ssId, (prev) => ({
          ...prev,
          fields: prev.fields.filter((f) => f.id !== fieldId),
          options: prev.options.filter((o) => o.fieldId !== fieldId),
          fileRules: prev.fileRules.filter((r) => r.fieldId !== fieldId),
        }))
      },

      addOption: (fieldId) => {
        const ssId = stepSetIdOfField(fieldId)
        if (!ssId) return { ok: false, error: "Field not found" }
        return editStepSetOf(ssId, (prev) => {
          const position = prev.options.filter((o) => o.fieldId === fieldId).length + 1
          return {
            ...prev,
            options: [
              ...prev.options,
              { id: nextId("OPT"), fieldId, position, value: `option-${position}`, label: `Option ${position}` },
            ],
          }
        })
      },

      updateOption: (optionId, patch) => {
        const option = state.options.find((o) => o.id === optionId)
        const ssId = option ? stepSetIdOfField(option.fieldId) : undefined
        if (!ssId) return { ok: false, error: "Option not found" }
        return editStepSetOf(ssId, (prev) => ({
          ...prev,
          options: prev.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
        }))
      },

      removeOption: (optionId) => {
        const option = state.options.find((o) => o.id === optionId)
        const ssId = option ? stepSetIdOfField(option.fieldId) : undefined
        if (!ssId) return { ok: false, error: "Option not found" }
        return editStepSetOf(ssId, (prev) => ({
          ...prev,
          options: prev.options.filter((o) => o.id !== optionId),
        }))
      },

      updateFileRule: (fieldId, patch) => {
        const ssId = stepSetIdOfField(fieldId)
        if (!ssId) return { ok: false, error: "Field not found" }
        return editStepSetOf(ssId, (prev) => ({
          ...prev,
          fileRules: prev.fileRules.map((r) =>
            r.fieldId === fieldId ? { ...r, ...patch } : r
          ),
        }))
      },

      setActionEnabled: (stepActionId, enabled) => {
        const ssId = stepSetIdOfAction(stepActionId)
        if (!ssId) return { ok: false, error: "Action not found" }
        return editStepSetOf(ssId, (prev) => ({
          ...prev,
          stepActions: prev.stepActions.map((a) =>
            a.id === stepActionId ? { ...a, enabled } : a
          ),
        }))
      },

      setActionCommentRequired: (stepActionId, required) => {
        const ssId = stepSetIdOfAction(stepActionId)
        if (!ssId) return { ok: false, error: "Action not found" }
        return editStepSetOf(ssId, (prev) => ({
          ...prev,
          stepActions: prev.stepActions.map((a) =>
            a.id === stepActionId ? { ...a, commentRequired: required } : a
          ),
        }))
      },

      addReasonCode: (stepActionId, code, label) => {
        const ssId = stepSetIdOfAction(stepActionId)
        if (!ssId) return { ok: false, error: "Action not found" }
        if (!label.trim()) return { ok: false, error: "Reason label is required" }
        return editStepSetOf(ssId, (prev) => {
          const position =
            prev.reasonCodes.filter((r) => r.stepActionId === stepActionId).length + 1
          const reason: ReasonCode = {
            id: nextId("RC"),
            stepActionId,
            position,
            code: code.trim() || label.trim().toLowerCase().replace(/\s+/g, "-"),
            label: label.trim(),
          }
          return { ...prev, reasonCodes: [...prev.reasonCodes, reason] }
        })
      },

      removeReasonCode: (reasonCodeId) => {
        const reason = state.reasonCodes.find((r) => r.id === reasonCodeId)
        const ssId = reason ? stepSetIdOfAction(reason.stepActionId) : undefined
        if (!ssId) return { ok: false, error: "Reason code not found" }
        return editStepSetOf(ssId, (prev) => ({
          ...prev,
          reasonCodes: prev.reasonCodes.filter((r) => r.id !== reasonCodeId),
        }))
      },

      updateVerifyConfig: (stepId, patch) => {
        const ssId = stepSetIdOfStep(stepId)
        if (!ssId) return { ok: false, error: "Step not found" }
        return editStepSetOf(ssId, (prev) => ({
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === stepId && s.verifyConfig
              ? { ...s, verifyConfig: { ...s.verifyConfig, ...patch } }
              : s
          ),
        }))
      },

      // ---- programs ----------------------------------------------------------

      createProgram: ({ name, description, classification, templateId }) => {
        if (!name.trim()) return { ok: false, error: "Program name is required" }
        let base = state
        let stepSetId: string
        if (templateId) {
          const template = state.templates.find((t) => t.id === templateId)
          if (!template) return { ok: false, error: "Template not found" }
          if (template.status !== "published")
            return { ok: false, error: "Only published templates can be applied" }
          const copied = copyStepSet(state, template.stepSetId, nextId)
          base = copied.state
          stepSetId = copied.stepSetId
        } else {
          stepSetId = nextId("SS")
          base = { ...state, stepSets: [...state.stepSets, { id: stepSetId }] }
        }
        const programId = nextId("PRG")
        setState({
          ...base,
          programs: [
            ...base.programs,
            {
              id: programId,
              name: name.trim(),
              description: description.trim(),
              classification,
              createdFromTemplateId: templateId,
            },
          ],
          versions: [
            ...base.versions,
            { id: nextId("VER"), programId, versionNo: 1, status: "draft", stepSetId },
          ],
        })
        return { ok: true, id: programId }
      },

      publishVersion: (versionId) =>
        apply((prev) => {
          const version = prev.versions.find((v) => v.id === versionId)
          if (!version) return { error: "Version not found" }
          if (version.status !== "draft") return { error: "Only draft versions can be published" }
          if (decisionStepsOf(prev, version.stepSetId).length === 0)
            return { error: "Add at least one review step before publishing" }
          if (!stepsOf(prev, version.stepSetId).some((s) => s.type === "form"))
            return { error: "Add a form step before publishing" }
          return {
            state: {
              ...prev,
              versions: prev.versions.map((v) => {
                if (v.id === versionId)
                  return { ...v, status: "published", publishedAt: now() }
                // older published version stops accepting new applications;
                // in-flight applications stay pinned to it
                if (v.programId === version.programId && v.status === "published")
                  return { ...v, status: "archived" }
                return v
              }),
            },
          }
        }),

      createDraftFromPublished: (programId) =>
        apply((prev) => {
          if (prev.versions.some((v) => v.programId === programId && v.status === "draft"))
            return { error: "A draft version already exists for this program" }
          const published = prev.versions.find(
            (v) => v.programId === programId && v.status === "published"
          )
          if (!published) return { error: "No published version to copy" }
          const copied = copyStepSet(prev, published.stepSetId, nextId)
          const versionNo =
            Math.max(...prev.versions.filter((v) => v.programId === programId).map((v) => v.versionNo)) + 1
          return {
            state: {
              ...copied.state,
              versions: [
                ...copied.state.versions,
                { id: nextId("VER"), programId, versionNo, status: "draft", stepSetId: copied.stepSetId },
              ],
            },
          }
        }),

      // ---- applications --------------------------------------------------------

      startApplication: (programId) => {
        const version = state.versions.find(
          (v) => v.programId === programId && v.status === "published"
        )
        if (!version) return { ok: false, error: "Program has no published version" }
        const id = nextId("APP")
        const at = now()
        setState((prev) => ({
          ...prev,
          applications: [
            ...prev.applications,
            {
              id,
              programId,
              programVersionId: version.id,
              applicantId: prev.actingUserId,
              currentStepId: null,
              status: "draft",
              createdAt: at,
              updatedAt: at,
            },
          ],
        }))
        return { ok: true, id }
      },

      setAnswer: (applicationId, fieldId, patch) =>
        apply((prev) => {
          const app = prev.applications.find((a) => a.id === applicationId)
          if (!app) return { error: "Application not found" }
          if (app.status !== "draft" && app.status !== "returned")
            return { error: `Answers are read-only in status "${app.status}"` }
          if (app.applicantId !== prev.actingUserId)
            return { error: "Only the applicant can edit answers" }
          const existing = prev.answers.find(
            (a) => a.applicationId === applicationId && a.fieldId === fieldId
          )
          return {
            state: {
              ...prev,
              answers: existing
                ? prev.answers.map((a) => (a === existing ? { ...a, ...patch } : a))
                : [
                    ...prev.answers,
                    {
                      id: nextId("ANS"),
                      applicationId,
                      fieldId,
                      value: "",
                      checked: false,
                      files: [],
                      ...patch,
                    },
                  ],
            },
          }
        }),

      validate: (applicationId) => {
        const app = state.applications.find((a) => a.id === applicationId)
        if (!app) return {}
        const version = state.versions.find((v) => v.id === app.programVersionId)
        if (!version) return {}
        return validateAnswers(state, version.stepSetId, applicationId)
      },

      submitApplication: (applicationId) =>
        apply((prev) => {
          const result = submit(prev, {
            applicationId,
            actorId: prev.actingUserId,
            at: now(),
            idGen: nextId,
          })
          return result.ok ? { state: result.state } : { error: result.error }
        }),

      decideApplication: (input) =>
        apply((prev) => {
          const result = decide(prev, {
            ...input,
            actorId: prev.actingUserId,
            at: now(),
            idGen: nextId,
          })
          return result.ok ? { state: result.state } : { error: result.error }
        }),

      verifyApplication: (applicationId, passed, faceScore) =>
        apply((prev) => {
          const result = verify(prev, {
            applicationId,
            actorId: prev.actingUserId,
            passed,
            faceScore,
            at: now(),
            idGen: nextId,
          })
          return result.ok ? { state: result.state } : { error: result.error }
        }),

      disburseApplication: (input) =>
        apply((prev) => {
          const result = disburse(prev, {
            ...input,
            actorId: prev.actingUserId,
            at: now(),
            idGen: nextId,
          })
          return result.ok ? { state: result.state } : { error: result.error }
        }),

      allowedActionsFor: (app) => allowedActions(state, app, actingUser),

      setReviewVerdict: (applicationId, stepId, itemKey, verdict) =>
        apply((prev) => {
          const app = prev.applications.find((a) => a.id === applicationId)
          if (!app) return { error: "Application not found" }
          const step = prev.steps.find((s) => s.id === stepId)
          if (!step || step.type !== "review")
            return { error: "Not a review step" }
          if (app.status !== "submitted" || app.currentStepId !== stepId)
            return { error: "Application is not at this review step" }
          if (!step.assignedRole || !actingUser.roles.includes(step.assignedRole))
            return { error: `Only a ${step.assignedRole ?? "qualified"} can check items` }
          const existing = prev.reviewChecks.find(
            (c) => c.applicationId === applicationId && c.stepId === stepId && c.itemKey === itemKey
          )
          const rest = prev.reviewChecks.filter((c) => c !== existing)
          // clicking the same verdict again clears it back to pending
          if (existing && existing.verdict === verdict)
            return { state: { ...prev, reviewChecks: rest } }
          return {
            state: {
              ...prev,
              reviewChecks: [
                ...rest,
                {
                  id: nextId("RCK"),
                  applicationId,
                  stepId,
                  itemKey,
                  verdict,
                  checkedBy: prev.actingUserId,
                  at: now(),
                },
              ],
            },
          }
        }),

      commentOnApplication: (applicationId, comment) =>
        apply((prev) => {
          const result = addComment(prev, {
            applicationId,
            actorId: prev.actingUserId,
            comment,
            at: now(),
            idGen: nextId,
          })
          return result.ok ? { state: result.state } : { error: result.error }
        }),
    }
  }, [state, hydrated])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useWorkflow() {
  const ctx = React.useContext(StoreContext)
  if (!ctx) throw new Error("useWorkflow must be used inside <WorkflowProvider>")
  return ctx
}
