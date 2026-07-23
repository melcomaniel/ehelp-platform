"use client"

import Link from "next/link"

import { EmptyState, PageHeader, StatusPill } from "@/components/workflow/bits"
import { Card, CardContent } from "@/components/ui/card"
import { useWorkflow } from "@/lib/workflow/store"
import { APPLICATION_STATUS_LABEL } from "@/lib/workflow/types"
import {
  applicationsOfProgram,
  isActionableByReviewer,
  useReviewablePrograms,
} from "@/app/social-worker/applications/shared"
import { ChevronRightIcon, FolderOpenIcon, InboxIcon } from "lucide-react"

export default function SocialWorkerPrograms() {
  const { state, actingUser, hasRole } = useWorkflow()
  const programs = useReviewablePrograms()

  if (!hasRole("social_worker")) {
    return (
      <EmptyState
        title="Switch to the social worker to review applications"
        hint="Grace Villanueva is the seeded social worker (bottom of the sidebar)."
      />
    )
  }

  // Roll up every reviewable program's caseload for the header summary.
  const allApps = programs.flatMap((p) => applicationsOfProgram(state, p.id))
  const totalWaiting = allApps.filter((a) =>
    isActionableByReviewer(state, a, actingUser.roles)
  ).length

  return (
    <>
      <PageHeader
        title="Applications"
        description="Open a program to see its applicants, then review each one"
      />

      {programs.length === 0 ? (
        <EmptyState
          title="No programs assigned to you"
          hint="A review step must be assigned to the social worker."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryTile label="Programs" value={programs.length} />
            <SummaryTile label="Applicants" value={allApps.length} />
            <SummaryTile label="Awaiting your review" value={totalWaiting} accent />
          </div>

          <div className="grid gap-4">
            {programs.map((p) => {
              const apps = applicationsOfProgram(state, p.id)
              const waiting = apps.filter((a) =>
                isActionableByReviewer(state, a, actingUser.roles)
              ).length

              // Status breakdown for the pill row, ordered by the review lifecycle.
              const breakdown = (
                ["submitted", "verifying", "returned", "approved", "disbursed", "rejected"] as const
              )
                .map((status) => ({
                  status,
                  count: apps.filter((a) => a.status === status).length,
                }))
                .filter((b) => b.count > 0)

              const reviewed = apps.length - waiting
              const pct =
                apps.length === 0 ? 0 : Math.round((reviewed / apps.length) * 100)

              return (
                <Link
                  key={p.id}
                  href={`/social-worker/applications/${p.id}`}
                  className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
                    <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FolderOpenIcon className="size-5" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-heading font-semibold leading-tight">
                              {p.name}
                            </h3>
                            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                              {p.description}
                            </p>
                          </div>
                          {waiting > 0 ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground tabular-nums">
                              <InboxIcon className="size-3" />
                              {waiting} to review
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                              All caught up
                            </span>
                          )}
                        </div>

                        {breakdown.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {breakdown.map((b) => (
                              <StatusPill
                                key={b.status}
                                value={`${APPLICATION_STATUS_LABEL[b.status]} ${b.count}`}
                              />
                            ))}
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                            <span>
                              <span className="font-semibold text-foreground">
                                {apps.length}
                              </span>{" "}
                              applicants
                            </span>
                            <span>{pct}% reviewed</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <ChevronRightIcon className="hidden size-5 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function SummaryTile({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-3xl font-semibold tabular-nums ${
            accent ? "text-primary" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
