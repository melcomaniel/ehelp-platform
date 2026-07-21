"use client"

import { useEhelp } from "@/lib/ehelp/store"
import type { ApplicationStatus } from "@/lib/ehelp/types"
import { REGIONS } from "@/lib/ehelp/types"
import { PageHeader, StatusPill } from "@/components/ehelp/bits"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  FolderOpenIcon,
  HourglassIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react"

const PIPELINE: ApplicationStatus[] = [
  "Submitted",
  "In Evaluation",
  "For Approval",
  "Approved",
  "Disbursed",
  "Declined",
]

export default function OverviewPage() {
  const { state, can, actorLabel } = useEhelp()
  const apps = state.applications

  const kpis = [
    {
      label: "Total Applications",
      value: apps.length,
      icon: FolderOpenIcon,
      hint: "all regions, all programs",
    },
    {
      label: "Awaiting Approval",
      value: apps.filter((a) => a.status === "For Approval").length,
      icon: HourglassIcon,
      hint: "in approver queues",
    },
    {
      label: "Registered Customers",
      value: state.customers.length,
      icon: UsersIcon,
      hint: `${state.customers.filter((c) => c.faceScan === "Verified").length} face-verified`,
    },
    {
      label: "Disbursed",
      value: apps.filter((a) => a.status === "Disbursed").length,
      icon: WalletIcon,
      hint: "cooldown-gated releases",
    },
  ]

  const maxRegion = Math.max(
    1,
    ...REGIONS.map((r) => apps.filter((a) => a.region === r).length)
  )

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Signed in as ${actorLabel()} — switch role top-right to walk the full flow.`}
      />

      <div className="grid auto-rows-min gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <Card key={k.label}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardDescription>{k.label}</CardDescription>
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#0040E7]/10 text-[#0040E7]">
                  <Icon className="size-4" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="text-2xl font-semibold">{k.value}</div>
                <div className="text-xs text-muted-foreground">{k.hint}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid flex-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Pipeline by Stage</CardTitle>
            <CardDescription>
              Application lifecycle — Submitted → Evaluation → Approval →
              Disbursement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PIPELINE.map((s) => {
              const count = apps.filter((a) => a.status === s).length
              const pct = apps.length ? (count / apps.length) * 100 : 0
              return (
                <div key={s} className="flex items-center gap-3">
                  <div className="w-28 shrink-0">
                    <StatusPill value={s} />
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#0040E7]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-6 text-right text-sm tabular-nums">
                    {count}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Region</CardTitle>
            <CardDescription>
              {can("view-analytics")
                ? "National analytics view"
                : "Analytics permission not granted for this role — counts only"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {REGIONS.map((r) => {
              const count = apps.filter((a) => a.region === r).length
              return (
                <div key={r} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-sm">{r}</div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#FCD116]"
                      style={{ width: `${(count / maxRegion) * 100}%` }}
                    />
                  </div>
                  <div className="w-6 text-right text-sm tabular-nums">
                    {count}
                  </div>
                </div>
              )
            })}
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Open recommendations:{" "}
              {state.recommendations.filter((r) => r.status === "Open").length} ·
              Accounts pending approval:{" "}
              {state.accounts.filter((a) => a.status === "Pending Approval").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Last five audit events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.audit.slice(0, 5).map((e) => (
            <div key={e.id} className="flex items-baseline gap-3 text-sm">
              <span className="w-40 shrink-0 font-mono text-xs text-muted-foreground">
                {new Date(e.ts).toLocaleString()}
              </span>
              <span className="w-48 shrink-0 truncate text-muted-foreground">
                {e.actor}
              </span>
              <span className="font-mono text-xs">{e.action}</span>
              <span className="truncate text-muted-foreground">{e.detail}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  )
}
