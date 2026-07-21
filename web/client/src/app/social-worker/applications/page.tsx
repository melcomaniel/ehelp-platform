"use client"

import Link from "next/link"

import { EmptyState, PageHeader } from "@/components/workflow/bits"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useWorkflow } from "@/lib/workflow/store"
import {
  applicationsOfProgram,
  isActionableByReviewer,
  useReviewablePrograms,
} from "@/app/social-worker/applications/shared"
import { FolderOpenIcon } from "lucide-react"

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

  return (
    <>
      <PageHeader
        title="Applications"
        description="Open a program to see its applicants, then review each one"
      />
      {programs.length === 0 ? (
        <EmptyState title="No programs assigned to you" hint="A review step must be assigned to the social worker." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => {
            const apps = applicationsOfProgram(state, p.id)
            const waiting = apps.filter((a) => isActionableByReviewer(state, a, actingUser.roles)).length
            return (
              <Link key={p.id} href={`/social-worker/applications/${p.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpenIcon className="size-4 text-primary" />
                      {p.name}
                    </CardTitle>
                    <CardDescription>{p.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-4 text-sm">
                    <span className="tabular-nums">
                      <span className="font-semibold">{apps.length}</span>{" "}
                      <span className="text-muted-foreground">applicants</span>
                    </span>
                    <span className="tabular-nums">
                      <span className="font-semibold text-primary">{waiting}</span>{" "}
                      <span className="text-muted-foreground">to review</span>
                    </span>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
