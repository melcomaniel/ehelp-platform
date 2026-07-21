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
import { ChevronDownIcon } from "lucide-react"

const STATUS_TONE: Record<string, string> = {
  Submitted: "text-blue-600 bg-blue-50",
  "In Evaluation": "text-indigo-600 bg-indigo-50",
  "For Approval": "text-amber-600 bg-amber-50",
  Approved: "text-green-600 bg-green-50",
  Declined: "text-red-600 bg-red-50",
  Disbursed: "text-emerald-700 bg-emerald-50",
  Verified: "text-green-600 bg-green-50",
  Pending: "text-amber-600 bg-amber-50",
  "Pending Validation": "text-amber-600 bg-amber-50",
  "Pending Approval": "text-amber-600 bg-amber-50",
  Active: "text-green-600 bg-green-50",
  Open: "text-blue-600 bg-blue-50",
  Acted: "text-green-600 bg-green-50",
  High: "text-red-600 bg-red-50",
  Medium: "text-amber-600 bg-amber-50",
  Low: "text-slate-600 bg-slate-100",
}

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
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
}: {
  headers: string[]
  children: React.ReactNode
  empty?: boolean
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
                Nothing here yet.
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
  return <td className={cn("py-2.5 pr-4 align-top", className)} {...props} />
}

export function Field({
  label,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) {
  const id = React.useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
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
