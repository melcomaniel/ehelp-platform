"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const STATUS_TONE: Record<string, string> = {
  Draft: "text-slate-600 bg-slate-100",
  Verifying: "text-indigo-600 bg-indigo-50",
  Submitted: "text-blue-600 bg-blue-50",
  Returned: "text-amber-600 bg-amber-50",
  Approved: "text-green-600 bg-green-50",
  Disbursed: "text-emerald-700 bg-emerald-50",
  Rejected: "text-red-600 bg-red-50",
  Published: "text-green-600 bg-green-50",
  Archived: "text-slate-500 bg-slate-100",
  draft: "text-slate-600 bg-slate-100",
  published: "text-green-600 bg-green-50",
  archived: "text-slate-500 bg-slate-100",
}

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap capitalize",
        STATUS_TONE[value] ?? "text-muted-foreground bg-muted"
      )}
    >
      {value}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-heading text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

export function DataTable({
  headers,
  children,
  empty,
  emptyText = "Nothing here yet.",
}: {
  headers: string[]
  children: React.ReactNode
  empty?: boolean
  emptyText?: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {headers.map((h) => (
              <th key={h} className="pb-2 pr-4 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td
                colSpan={headers.length}
                className="py-6 text-center text-sm text-muted-foreground"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  )
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return <td className={cn("py-2.5 pr-4 align-top", className)} {...props} />
}

export function Field({
  label,
  error,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; error?: string }) {
  const id = React.useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={!!error} {...props} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export function CheckboxRow({
  label,
  checked,
  onChange,
  error,
  disabled,
}: {
  label: string
  checked: boolean
  onChange?: (v: boolean) => void
  error?: string
  disabled?: boolean
}) {
  const id = React.useId()
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="flex items-start gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-4 accent-primary"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span>{label}</span>
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
