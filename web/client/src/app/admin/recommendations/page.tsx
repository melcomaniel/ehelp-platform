"use client"

import * as React from "react"

import { useEhelp } from "@/lib/ehelp/store"
import {
  DataTable,
  Field,
  MenuSelect,
  PageHeader,
  StatusPill,
  Td,
} from "@/components/ehelp/bits"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PlusIcon } from "lucide-react"

const PRIORITIES = ["High", "Medium", "Low"] as const

export default function RecommendationsPage() {
  const { state, can, actorLabel, submitRecommendation, actRecommendation } =
    useEhelp()
  const { region } = state.session

  const [open, setOpen] = React.useState(false)
  const [subject, setSubject] = React.useState("")
  const [note, setNote] = React.useState("")
  const [priority, setPriority] =
    React.useState<(typeof PRIORITIES)[number]>("Medium")

  const submit = () => {
    if (!subject) return
    submitRecommendation({
      subject,
      note,
      priority,
      region,
      submittedBy: actorLabel(),
    })
    setOpen(false)
    setSubject("")
    setNote("")
  }

  return (
    <>
      <PageHeader
        title="Recommendations"
        description="Priority recommendations from evaluators and satellite admins — approvers act on them"
      >
        {can("submit-recommendations") && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <PlusIcon /> Submit recommendation
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardContent>
          <DataTable
            headers={[
              "ID",
              "Subject",
              "Priority",
              "Submitted By",
              "Region",
              "Note",
              "Status",
              "Actions",
            ]}
            empty={state.recommendations.length === 0}
          >
            {state.recommendations.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <Td className="font-mono text-xs">{r.id}</Td>
                <Td className="font-mono text-xs">{r.subject}</Td>
                <Td>
                  <StatusPill value={r.priority} />
                </Td>
                <Td className="text-muted-foreground">{r.submittedBy}</Td>
                <Td className="text-muted-foreground">{r.region}</Td>
                <Td className="max-w-72 text-xs text-muted-foreground">{r.note}</Td>
                <Td>
                  <StatusPill value={r.status} />
                </Td>
                <Td>
                  {can("act-recommendations") &&
                  r.status === "Open" &&
                  r.region === region ? (
                    <Button size="xs" onClick={() => actRecommendation(r.id)}>
                      Mark acted
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Submit priority recommendation</SheetTitle>
            <SheetDescription>
              Reference a case number or program; the regional approver picks it
              up.
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 px-4">
            <Field
              label="Subject (case no. or program)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="APP-0003"
            />
            <MenuSelect
              label="Priority"
              value={priority}
              options={PRIORITIES}
              onChange={setPriority}
            />
            <Field
              label="Justification"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Household displaced by flooding"
            />
          </div>
          <SheetFooter>
            <Button onClick={submit} disabled={!subject}>
              Submit
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  )
}
