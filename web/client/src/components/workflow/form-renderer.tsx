"use client"

import * as React from "react"

import {
  CheckboxRow,
  Field,
  NativeSelect,
  Textarea,
} from "@/components/workflow/bits"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  answerFor,
  fieldsOf,
  fileRuleOf,
  optionsOf,
  stepsOf,
} from "@/lib/workflow/engine"
import { useWorkflow } from "@/lib/workflow/store"
import type { FileMeta, FormField } from "@/lib/workflow/types"
import { FileIcon, XIcon } from "lucide-react"

function prettySize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * Renders every form step of a step set from its stored field definitions.
 * Editable (draft/returned, applicant) or read-only (review detail).
 */
export function FormRenderer({
  stepSetId,
  applicationId,
  readOnly = false,
  errors = {},
}: {
  stepSetId: string
  applicationId: string
  readOnly?: boolean
  errors?: Record<string, string>
}) {
  const { state } = useWorkflow()
  const formSteps = stepsOf(state, stepSetId).filter((s) => s.type === "form")

  return (
    <div className="flex flex-col gap-6">
      {formSteps.map((step) => (
        <section key={step.id} className="grid gap-4">
          {formSteps.length > 1 && (
            <h3 className="font-heading text-sm font-semibold">{step.name}</h3>
          )}
          {fieldsOf(state, step.id).map((field) => (
            <FieldControl
              key={field.id}
              field={field}
              applicationId={applicationId}
              readOnly={readOnly}
              error={errors[field.id]}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function FieldControl({
  field,
  applicationId,
  readOnly,
  error,
}: {
  field: FormField
  applicationId: string
  readOnly: boolean
  error?: string
}) {
  const { state, setAnswer } = useWorkflow()
  const answer = answerFor(state, applicationId, field.id)
  const value = answer?.value ?? ""
  const label = field.required ? `${field.label} *` : field.label

  const set = (patch: Parameters<typeof setAnswer>[2]) =>
    setAnswer(applicationId, field.id, patch)

  if (field.type === "checkbox") {
    return (
      <CheckboxRow
        label={label}
        checked={answer?.checked ?? false}
        disabled={readOnly}
        onChange={(v) => set({ checked: v })}
        error={error}
      />
    )
  }

  if (field.type === "file") {
    return (
      <FileControl
        field={field}
        label={label}
        files={answer?.files ?? []}
        readOnly={readOnly}
        error={error}
        onChange={(files) => set({ files })}
      />
    )
  }

  const help = field.helpText && (
    <p className="text-xs text-muted-foreground">{field.helpText}</p>
  )

  if (field.type === "textarea") {
    return (
      <div className="grid gap-1.5">
        <Label>{label}</Label>
        {help}
        <Textarea
          value={value}
          disabled={readOnly}
          aria-invalid={!!error}
          onChange={(e) => set({ value: e.target.value })}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  if (field.type === "select") {
    const opts = optionsOf(state, field.id)
    return (
      <div className="grid gap-1.5">
        <Label>{label}</Label>
        {help}
        <NativeSelect
          value={value}
          disabled={readOnly}
          aria-invalid={!!error}
          onChange={(e) => set({ value: e.target.value })}
        >
          <option value="">Select…</option>
          {opts.map((o) => (
            <option key={o.id} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="grid gap-1.5">
      {help}
      <Field
        label={label}
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        value={value}
        disabled={readOnly}
        error={error}
        onChange={(e) => set({ value: e.target.value })}
      />
    </div>
  )
}

function FileControl({
  field,
  label,
  files,
  readOnly,
  error,
  onChange,
}: {
  field: FormField
  label: string
  files: FileMeta[]
  readOnly: boolean
  error?: string
  onChange: (files: FileMeta[]) => void
}) {
  const { state } = useWorkflow()
  const rule = fileRuleOf(state, field.id)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const pick = (list: FileList | null) => {
    if (!list) return
    const added: FileMeta[] = Array.from(list).map((f) => ({
      name: f.name,
      sizeBytes: f.size,
      mime: f.type,
      url: URL.createObjectURL(f),
    }))
    const max = rule?.maxCount ?? Infinity
    onChange([...files, ...added].slice(0, max))
  }

  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
      {rule && (
        <p className="text-xs text-muted-foreground">
          Allowed: {rule.allowedMime.join(", ")} · max {rule.maxSizeMb} MB ·{" "}
          {rule.minCount}–{rule.maxCount} file{rule.maxCount > 1 ? "s" : ""}
        </p>
      )}
      <ul className="grid gap-1.5">
        {files.map((f, i) => (
          <li
            key={`${f.name}-${i}`}
            className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
          >
            <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
            {f.url ? (
              <a href={f.url} download={f.name} className="min-w-0 flex-1 truncate hover:underline">
                {f.name}
              </a>
            ) : (
              <span className="min-w-0 flex-1 truncate" title="Preview unavailable after reload — metadata retained">
                {f.name}
              </span>
            )}
            <span className="shrink-0 text-xs text-muted-foreground">{prettySize(f.sizeBytes)}</span>
            {!readOnly && (
              <button
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
                aria-label={`Remove ${f.name}`}
              >
                <XIcon className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple={(rule?.maxCount ?? 1) > 1}
            accept={rule?.allowedMime.join(",")}
            className="hidden"
            onChange={(e) => {
              pick(e.target.files)
              e.target.value = ""
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={!!rule && files.length >= rule.maxCount}
          >
            Add file
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
