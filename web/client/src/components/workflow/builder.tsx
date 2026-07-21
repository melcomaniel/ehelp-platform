"use client"

import * as React from "react"

import {
  CheckboxRow,
  EmptyState,
  Field,
  NativeSelect,
  Textarea,
} from "@/components/workflow/bits"
import { usePrompts } from "@/components/workflow/prompts"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  actionsOf,
  fieldsOf,
  fileRuleOf,
  optionsOf,
  reasonCodesOf,
  stepsOf,
} from "@/lib/workflow/engine"
import { useWorkflow, type MutationResult } from "@/lib/workflow/store"
import type {
  DecisionAction,
  FieldType,
  RoleKey,
  Step,
  StepType,
} from "@/lib/workflow/types"
import { ROLE_LABEL, STEP_TYPE_LABEL } from "@/lib/workflow/types"
import { cn } from "@/lib/utils"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BanknoteIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  LockIcon,
  PlusIcon,
  ScanFaceIcon,
  Trash2Icon,
} from "lucide-react"

const STEP_ICON: Record<StepType, React.ReactNode> = {
  form: <FileTextIcon className="size-3.5" />,
  verify: <ScanFaceIcon className="size-3.5" />,
  review: <ClipboardCheckIcon className="size-3.5" />,
  disbursement: <BanknoteIcon className="size-3.5" />,
}

const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "textarea", label: "Long text" },
  { type: "number", label: "Number" },
  { type: "date", label: "Date" },
  { type: "select", label: "Choice" },
  { type: "checkbox", label: "Checkbox" },
  { type: "file", label: "File upload" },
]

const DECISION_ROLES: RoleKey[] = ["reviewer", "approver", "admin"]

/**
 * Full-page step-set builder — shared by templates and program draft
 * versions. `locked` renders everything read-only (published version /
 * archived template).
 */
export function StepSetBuilder({
  stepSetId,
  locked,
  lockNote,
}: {
  stepSetId: string
  locked: boolean
  lockNote?: string
}) {
  const { state, addStep, moveStep, removeStep } = useWorkflow()
  const { toast, confirm } = usePrompts()
  const steps = stepsOf(state, stepSetId)
  const [selectedId, setSelectedId] = React.useState<string | null>(steps[0]?.id ?? null)
  const selected = steps.find((s) => s.id === selectedId) ?? steps[0] ?? null

  const run = (result: MutationResult) => {
    if (!result.ok) toast({ title: "Not allowed", description: result.error, variant: "error" })
    return result.ok
  }

  const onRemoveStep = async (step: Step) => {
    const ok = await confirm({
      title: `Delete step "${step.name}"?`,
      description:
        "The step and everything configured on it (fields, actions, reason codes) will be removed from this draft.",
      confirmLabel: "Delete step",
      destructive: true,
    })
    if (!ok) return
    if (run(removeStep(step.id)) && selectedId === step.id) setSelectedId(null)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_2fr]">
      {locked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 lg:col-span-2">
          <LockIcon className="size-3.5 shrink-0" />
          {lockNote ?? "This step set is read-only."}
        </div>
      )}

      {/* step list */}
      <Card className="self-start">
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
          <CardDescription>Steps run top to bottom</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {steps.length === 0 && (
            <p className="text-sm text-muted-foreground">No steps yet — add one below.</p>
          )}
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm",
                selected?.id === step.id && "border-primary bg-primary/5"
              )}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => setSelectedId(step.id)}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                  {STEP_ICON[step.type]}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {i + 1}. {step.name}
                  </span>
                  <span className="block text-xs text-muted-foreground capitalize">
                    {step.type}
                    {step.assignedRole ? ` · ${ROLE_LABEL[step.assignedRole]}` : ""}
                  </span>
                </span>
              </button>
              {!locked && (
                <span className="flex shrink-0 gap-0.5">
                  <Button variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => run(moveStep(step.id, -1))} aria-label="Move up">
                    <ArrowUpIcon />
                  </Button>
                  <Button variant="ghost" size="icon-xs" disabled={i === steps.length - 1} onClick={() => run(moveStep(step.id, 1))} aria-label="Move down">
                    <ArrowDownIcon />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => onRemoveStep(step)} aria-label="Delete step">
                    <Trash2Icon />
                  </Button>
                </span>
              )}
            </div>
          ))}

          {!locked && (
            <div className="mt-1 grid gap-1.5">
              <p className="text-xs text-muted-foreground">Add step</p>
              <div className="flex flex-wrap gap-1.5">
                {(["form", "verify", "review", "disbursement"] as StepType[]).map((t) => (
                  <Button
                    key={t}
                    variant="outline"
                    size="xs"
                    onClick={() => run(addStep(stepSetId, t))}
                  >
                    <PlusIcon /> {STEP_TYPE_LABEL[t]}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* step config */}
      <div className="grid gap-4 self-start">
        {selected ? (
          <StepConfig step={selected} locked={locked} run={run} />
        ) : (
          <EmptyState
            title="Select a step to configure it"
            hint="Or add a step from the palette on the left."
          />
        )}
      </div>
    </div>
  )
}

function StepConfig({
  step,
  locked,
  run,
}: {
  step: Step
  locked: boolean
  run: (r: MutationResult) => boolean
}) {
  const { updateStep } = useWorkflow()
  const hasRole = step.type === "review" || step.type === "disbursement"

  const description: Record<Step["type"], string> = {
    form: "Applicant-facing inputs, rendered in the stepper",
    verify: "Applicant opens the camera for a face check — the title is yours to name, the purpose is eVerify identity verification",
    review: "Human decision — approve, return, or reject. Chain several review steps for tiered sign-off. The engine never auto-advances past a review.",
    disbursement: "Release funds after the last review — payee, amount, instrument, then the application is disbursed",
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{STEP_TYPE_LABEL[step.type]} step</CardTitle>
          <CardDescription>{description[step.type]}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Step title"
            value={step.name}
            disabled={locked}
            onChange={(e) => run(updateStep(step.id, { name: e.target.value }))}
          />
          {hasRole && (
            <div className="grid gap-1.5">
              <Label>Assigned role</Label>
              <NativeSelect
                value={step.assignedRole ?? "reviewer"}
                disabled={locked}
                onChange={(e) => run(updateStep(step.id, { assignedRole: e.target.value as RoleKey }))}
              >
                {DECISION_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
        </CardContent>
      </Card>

      {step.type === "form" && <FormStepConfig stepId={step.id} locked={locked} run={run} />}
      {step.type === "verify" && <VerifyStepConfig step={step} locked={locked} run={run} />}
      {step.type === "review" && (
        <DecisionStepConfig stepId={step.id} locked={locked} run={run} />
      )}
      {/* disbursement: title + assigned role only, no extra config */}
    </>
  )
}

// ---- verify step config -----------------------------------------------------

function VerifyStepConfig({
  step,
  locked,
  run,
}: {
  step: Step
  locked: boolean
  run: (r: MutationResult) => boolean
}) {
  const { updateVerifyConfig } = useWorkflow()
  const config = step.verifyConfig
  if (!config) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification checks</CardTitle>
        <CardDescription>Mocked in this build — no real eVerify API is called</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Field
          label="Provider label"
          value={config.provider}
          disabled={locked}
          onChange={(e) => run(updateVerifyConfig(step.id, { provider: e.target.value }))}
        />
        <CheckboxRow
          label="Face liveness (open camera, capture face)"
          checked={config.faceLiveness}
          disabled={locked}
          onChange={(v) => run(updateVerifyConfig(step.id, { faceLiveness: v }))}
        />
        <CheckboxRow
          label="PhilSys ID match"
          checked={config.philsysMatch}
          disabled={locked}
          onChange={(v) => run(updateVerifyConfig(step.id, { philsysMatch: v }))}
        />
      </CardContent>
    </Card>
  )
}

// ---- form step: field builder ----------------------------------------------

function FormStepConfig({
  stepId,
  locked,
  run,
}: {
  stepId: string
  locked: boolean
  run: (r: MutationResult) => boolean
}) {
  const {
    state,
    addField,
    updateField,
    moveField,
    removeField,
    addOption,
    updateOption,
    removeOption,
    updateFileRule,
  } = useWorkflow()
  const fields = fieldsOf(state, stepId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fields</CardTitle>
        <CardDescription>What the applicant fills in</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">No fields yet.</p>
        )}
        {fields.map((field, i) => {
          const rule = fileRuleOf(state, field.id)
          return (
            <div key={field.id} className="grid gap-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-end gap-3">
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground capitalize">
                  {FIELD_TYPES.find((t) => t.type === field.type)?.label ?? field.type}
                </span>
                <div className="min-w-40 flex-1">
                  <Field
                    label="Label"
                    value={field.label}
                    disabled={locked}
                    onChange={(e) => run(updateField(field.id, { label: e.target.value }))}
                  />
                </div>
                <CheckboxRow
                  label="Required"
                  checked={field.required}
                  disabled={locked}
                  onChange={(v) => run(updateField(field.id, { required: v }))}
                />
                {!locked && (
                  <span className="ml-auto flex gap-0.5">
                    <Button variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => run(moveField(field.id, -1))} aria-label="Move up">
                      <ArrowUpIcon />
                    </Button>
                    <Button variant="ghost" size="icon-xs" disabled={i === fields.length - 1} onClick={() => run(moveField(field.id, 1))} aria-label="Move down">
                      <ArrowDownIcon />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => run(removeField(field.id))} aria-label="Delete field">
                      <Trash2Icon />
                    </Button>
                  </span>
                )}
              </div>

              <div className="grid gap-1.5">
                <Label>Help text</Label>
                <Textarea
                  className="min-h-9"
                  value={field.helpText}
                  disabled={locked}
                  onChange={(e) => run(updateField(field.id, { helpText: e.target.value }))}
                />
              </div>

              {field.type === "select" && (
                <div className="grid gap-1.5">
                  <Label>Options</Label>
                  {optionsOf(state, field.id).map((o) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <Input
                        className="flex-1"
                        value={o.label}
                        disabled={locked}
                        onChange={(e) =>
                          run(
                            updateOption(o.id, {
                              label: e.target.value,
                              value: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                            })
                          )
                        }
                      />
                      {!locked && (
                        <Button variant="ghost" size="icon-xs" onClick={() => run(removeOption(o.id))} aria-label="Remove option">
                          <Trash2Icon />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!locked && (
                    <Button variant="outline" size="xs" className="justify-self-start" onClick={() => run(addOption(field.id))}>
                      <PlusIcon /> Add option
                    </Button>
                  )}
                </div>
              )}

              {field.type === "file" && rule && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label>Allowed formats (comma-separated MIME types)</Label>
                    <Input
                      value={rule.allowedMime.join(", ")}
                      disabled={locked}
                      onChange={(e) =>
                        run(
                          updateFileRule(field.id, {
                            allowedMime: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          })
                        )
                      }
                    />
                  </div>
                  <Field
                    label="Max size (MB)"
                    type="number"
                    value={String(rule.maxSizeMb)}
                    disabled={locked}
                    onChange={(e) => run(updateFileRule(field.id, { maxSizeMb: Math.max(1, Number(e.target.value) || 1) }))}
                  />
                  <div className="flex gap-3">
                    <Field
                      label="Min files"
                      type="number"
                      value={String(rule.minCount)}
                      disabled={locked}
                      onChange={(e) => run(updateFileRule(field.id, { minCount: Math.max(0, Number(e.target.value) || 0) }))}
                    />
                    <Field
                      label="Max files"
                      type="number"
                      value={String(rule.maxCount)}
                      disabled={locked}
                      onChange={(e) => run(updateFileRule(field.id, { maxCount: Math.max(1, Number(e.target.value) || 1) }))}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {!locked && (
          <div className="grid gap-1.5">
            <p className="text-xs text-muted-foreground">Add field</p>
            <div className="flex flex-wrap gap-1.5">
              {FIELD_TYPES.map((t) => (
                <Button key={t.type} variant="outline" size="xs" onClick={() => run(addField(stepId, t.type))}>
                  <PlusIcon /> {t.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---- decision step: actions + reason codes -----------------------------------

const ACTION_LABEL: Record<DecisionAction, string> = {
  approve: "Approve",
  return: "Return for compliance",
  reject: "Reject (terminal)",
}

function DecisionStepConfig({
  stepId,
  locked,
  run,
}: {
  stepId: string
  locked: boolean
  run: (r: MutationResult) => boolean
}) {
  const {
    state,
    setActionEnabled,
    setActionCommentRequired,
    addReasonCode,
    removeReasonCode,
  } = useWorkflow()
  const actions = actionsOf(state, stepId)
  const ordered: DecisionAction[] = ["approve", "return", "reject"]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>
          What the assigned role can do here. Return and reject carry a reason
          code and comment for the audit trail.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {ordered.map((name) => {
          const action = actions.find((a) => a.action === name)
          if (!action) return null
          return (
            <div key={action.id} className="grid gap-2.5 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-4">
                <span className="min-w-40 text-sm font-medium">{ACTION_LABEL[name]}</span>
                <CheckboxRow
                  label="Enabled"
                  checked={action.enabled}
                  disabled={locked}
                  onChange={(v) => run(setActionEnabled(action.id, v))}
                />
                <CheckboxRow
                  label="Comment required"
                  checked={action.commentRequired}
                  disabled={locked}
                  onChange={(v) => run(setActionCommentRequired(action.id, v))}
                />
              </div>

              {name !== "approve" && (
                <ReasonCodeEditor
                  stepActionId={action.id}
                  locked={locked}
                  run={run}
                  addReasonCode={addReasonCode}
                  removeReasonCode={removeReasonCode}
                />
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ReasonCodeEditor({
  stepActionId,
  locked,
  run,
  addReasonCode,
  removeReasonCode,
}: {
  stepActionId: string
  locked: boolean
  run: (r: MutationResult) => boolean
  addReasonCode: (id: string, code: string, label: string) => MutationResult
  removeReasonCode: (id: string) => MutationResult
}) {
  const { state } = useWorkflow()
  const [label, setLabel] = React.useState("")
  const codes = reasonCodesOf(state, stepActionId)

  return (
    <div className="grid gap-1.5">
      <Label>Reason codes</Label>
      <div className="flex flex-wrap gap-1.5">
        {codes.length === 0 && (
          <span className="text-xs text-muted-foreground">
            None — the action will only ask for a comment.
          </span>
        )}
        {codes.map((c) => (
          <span key={c.id} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
            {c.label}
            {!locked && (
              <button
                onClick={() => run(removeReasonCode(c.id))}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${c.label}`}
              >
                <Trash2Icon className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {!locked && (
        <div className="flex gap-1.5">
          <Input
            placeholder="e.g. Missing document"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!label.trim()}
            onClick={() => {
              if (run(addReasonCode(stepActionId, "", label))) setLabel("")
            }}
          >
            <PlusIcon /> Add
          </Button>
        </div>
      )}
    </div>
  )
}
