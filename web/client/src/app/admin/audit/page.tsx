"use client"

import * as React from "react"

import { useEhelp } from "@/lib/ehelp/store"
import { DataTable, PageHeader, Td } from "@/components/ehelp/bits"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function AuditPage() {
  const { state } = useEhelp()
  const [query, setQuery] = React.useState("")

  const rows = state.audit.filter((e) =>
    `${e.actor} ${e.action} ${e.detail}`.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Security and configuration events — platform admins see platform-scoped events; organization admins see org-scoped events. Case PII is not exposed here."
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by actor, action, detail…"
          className="w-72"
        />
      </PageHeader>

      <Card>
        <CardContent>
          <DataTable
            headers={["Timestamp", "Actor", "Action", "Detail"]}
            empty={rows.length === 0}
          >
            {rows.map((e) => (
              <tr key={e.id} className="border-b last:border-0">
                <Td className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(e.ts).toLocaleString()}
                </Td>
                <Td className="text-muted-foreground">{e.actor}</Td>
                <Td className="font-mono text-xs">{e.action}</Td>
                <Td className="text-muted-foreground">{e.detail}</Td>
              </tr>
            ))}
          </DataTable>
        </CardContent>
      </Card>
    </>
  )
}
