"use client"

import { useWorkflow } from "@/lib/workflow/store"
import type { Program, WorkflowApplication } from "@/lib/workflow/types"

/** Programs whose published version has a review step assigned to the acting user's roles. */
export function useReviewablePrograms(): Program[] {
  const { state, actingUser } = useWorkflow()
  return state.programs.filter((p) => {
    const version = state.versions.find(
      (v) => v.programId === p.id && v.status === "published"
    )
    if (!version) return false
    return state.steps.some(
      (s) =>
        s.stepSetId === version.stepSetId &&
        s.type === "review" &&
        !!s.assignedRole &&
        actingUser.roles.includes(s.assignedRole)
    )
  })
}

/** Every application in a program (full caseload), newest first. */
export function applicationsOfProgram(
  state: ReturnType<typeof useWorkflow>["state"],
  programId: string
): WorkflowApplication[] {
  return state.applications
    .filter((a) => a.programId === programId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Is this application at a review step the acting user may act on now? */
export function isActionableByReviewer(
  state: ReturnType<typeof useWorkflow>["state"],
  app: WorkflowApplication,
  roles: string[]
): boolean {
  if (app.status !== "submitted" || !app.currentStepId) return false
  const step = state.steps.find((s) => s.id === app.currentStepId)
  return step?.type === "review" && !!step.assignedRole && roles.includes(step.assignedRole)
}
