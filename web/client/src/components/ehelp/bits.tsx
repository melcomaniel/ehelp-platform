"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ChevronDownIcon, InboxIcon } from "lucide-react"

const STATUS_TONE: Record<string, string> = {
  Submitted: "text-blue-700 bg-blue-50 ring-blue-200",
  "In Evaluation": "text-indigo-700 bg-indigo-50 ring-indigo-200",
  "For Approval": "text-amber-800 bg-amber-50 ring-amber-200",
  Approved: "text-green-700 bg-green-50 ring-green-200",
  Declined: "text-red-700 bg-red-50 ring-red-200",
  Disbursed: "text-emerald-800 bg-emerald-50 ring-emerald-200",
  Verified: "text-green-700 bg-green-50 ring-green-200",
  Pending: "text-amber-800 bg-amber-50 ring-amber-200",
  "Pending Validation": "text-amber-800 bg-amber-50 ring-amber-200",
  "Pending Approval": "text-amber-800 bg-amber-50 ring-amber-200",
  Active: "text-green-700 bg-green-50 ring-green-200",
  Open: "text-blue-700 bg-blue-50 ring-blue-200",
  Acted: "text-green-700 bg-green-50 ring-green-200",
  High: "text-red-700 bg-red-50 ring-red-200",
  Medium: "text-amber-800 bg-amber-50 ring-amber-200",
  Low: "text-slate-700 bg-slate-100 ring-slate-200",
}

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1",
        STATUS_TONE[value] ?? "text-muted-foreground bg-muted ring-border"
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
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
    <div className="flex flex-col justify-between gap-3 border-b pb-4 sm:flex-row sm:items-start">
      <div className="max-w-3xl">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {title}
        </h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  children,
  icon,
}: {
  title: string
  description: string
  children?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
        {icon ?? <InboxIcon className="size-5" aria-hidden />}
      </div>
      <div className="max-w-md space-y-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

export function DataTable({
  headers,
  children,
  empty,
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting the filters or check again later.",
  caption,
}: {
  headers: string[]
  children: React.ReactNode
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  caption?: string
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[44rem] text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b bg-muted/60 text-left text-xs font-semibold uppercase text-muted-foreground">
            {headers.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 whitespace-nowrap">
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
                className="px-4 py-10 text-center text-sm text-muted-foreground"
              >
                <span className="font-medium text-foreground">{emptyTitle}</span>
                <span className="mt-1 block">{emptyDescription}</span>
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

export function Td({
  className,
  ...props
}: React.ComponentProps<"td">) {
  return <td className={cn("px-4 py-3 align-top", className)} {...props} />
}

export function Field({
  label,
  required,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string
  required?: boolean
  hint?: string
}) {
  const id = React.useId()
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {hint ? (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <Input id={id} required={required} aria-describedby={hintId} {...props} />
    </div>
  )
}

export function MenuSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "default",
}: {
  label?: string
  value: string
  options: readonly T[]
  onChange: (v: T) => void
  size?: "default" | "sm" | "xs"
}) {
  const control = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size={size} className="justify-between gap-2" />
        }
      >
        {value}
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {options.map((o) => (
          <DropdownMenuItem key={o} onClick={() => onChange(o)}>
            {o}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
  if (!label) return control
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {control}
    </div>
  )
}
