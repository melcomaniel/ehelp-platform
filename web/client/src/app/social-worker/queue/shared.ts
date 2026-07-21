"use client"

import { useWorkflow } from "@/lib/workflow/store"
import type { WorkflowApplication } from "@/lib/workflow/types"

export const FOURPS_PROGRAM_ID = "PRG-4PS"

/** 4Ps applications waiting at a review step assigned to the acting social worker. */
export function useFourPsQueue(): WorkflowApplication[] {
  const { state, actingUser } = useWorkflow()
  return state.applications
    .filter((a) => {
      if (a.programId !== FOURPS_PROGRAM_ID) return false
      if (a.status !== "submitted" || !a.currentStepId) return false
      const step = state.steps.find((s) => s.id === a.currentStepId)
      return step?.type === "review" && !!step.assignedRole && actingUser.roles.includes(step.assignedRole)
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
