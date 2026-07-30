"use client"

import Link from "next/link"
import { useParams } from "next/navigation"

import { EmptyState, PageHeader, StatusPill } from "@/components/ehelp/bits"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEhelp } from "@/lib/ehelp/store"
import { ArrowLeftIcon, FileTextIcon } from "lucide-react"

export default function AdminApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { state } = useEhelp()

  const application = state.applications.find((item) => item.id === id)

  if (!application) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            title="Application not found"
            description="The selected application may have been removed."
            icon={<FileTextIcon className="size-5" aria-hidden />}
          >
            <Button variant="outline" render={<Link href="/admin/applications" />}>
              <ArrowLeftIcon /> Applications
            </Button>
          </EmptyState>
        </CardContent>
      </Card>
    )
  }

  const customer = state.customers.find((item) => item.id === application.customerId)
  const template = state.templates.find((item) => item.id === application.templateId)
  const dependents = state.dependents.filter(
    (item) => item.customerId === application.customerId,
  )
  const recommendations = state.recommendations.filter(
    (item) => item.subject === application.id,
  )
  const audits = state.audit.filter((item) => item.detail.includes(application.id))

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Application ${application.id}`}
        description={`${customer?.name ?? application.customerId} · ${
          template?.name ?? application.templateId
        }`}
      >
        <div className="flex items-center gap-2">
          <StatusPill value={application.status} />
          <Button size="sm" variant="ghost" render={<Link href="/admin/applications" />}>
            <ArrowLeftIcon /> Applications
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardContent className="grid gap-x-6 gap-y-3 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <DetailItem label="Region" value={application.region} />
          <DetailItem label="Priority" value={<StatusPill value={application.priority} />} />
          <DetailItem label="Filed by" value={application.filedBy} />
          <DetailItem
            label="Last updated"
            value={new Date(application.updatedAt).toLocaleString()}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Application details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <DetailItem label="Case number" value={application.id} mono />
            <DetailItem label="Status" value={<StatusPill value={application.status} />} />
            <DetailItem label="Program template" value={template?.name ?? application.templateId} />
            <DetailItem label="Program" value={template?.program ?? "—"} />
            <DetailItem label="Requirements" value={template?.requirements ?? "—"} wide />
            <DetailItem
              label="Case note"
              value={application.note ?? "No case note recorded."}
              wide
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
            <DetailItem label="Customer" value={customer?.name ?? application.customerId} />
            <DetailItem label="Customer ID" value={application.customerId} mono />
            <DetailItem label="PhilSys ID" value={customer?.philsysId ?? "—"} mono />
            <DetailItem label="Face scan" value={customer?.faceScan ?? "—"} />
            <DetailItem label="ID records" value={customer?.idRecords ? "Complete" : "Missing"} />
            <DetailItem
              label="Disbursement preference"
              value={customer?.disbursementPref ?? "—"}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Related dependents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dependents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dependents recorded.</p>
            ) : (
              dependents.map((dependent) => (
                <div key={dependent.id} className="rounded-md border px-3 py-2 text-sm">
                  <p className="font-medium">{dependent.name}</p>
                  <p className="text-muted-foreground">
                    {dependent.kind} · {dependent.status}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Relationship record: {dependent.relationshipRecord ? "Yes" : "No"} ·
                    Notarized letter: {dependent.notarizedLetter ? "Yes" : "No"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recommendations recorded.</p>
            ) : (
              recommendations.map((recommendation) => (
                <div key={recommendation.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{recommendation.id}</p>
                    <StatusPill value={recommendation.status} />
                    <StatusPill value={recommendation.priority} />
                  </div>
                  <p className="mt-2 text-muted-foreground">{recommendation.note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted by {recommendation.submittedBy}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {audits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit events recorded.</p>
            ) : (
              audits.map((audit) => (
                <div key={audit.id} className="border-b pb-2 text-sm last:border-0">
                  <p className="font-medium">{audit.action}</p>
                  <p className="text-muted-foreground">{audit.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {audit.actor} · {new Date(audit.ts).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DetailItem({
  label,
  value,
  mono,
  wide,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  wide?: boolean
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <div className={mono ? "mt-1 font-mono text-xs" : "mt-1"}>{value}</div>
    </div>
  )
}
