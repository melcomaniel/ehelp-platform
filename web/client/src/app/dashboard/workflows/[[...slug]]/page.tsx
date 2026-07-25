import { redirect } from "next/navigation"

/** Old workflow-engine paths now live under the admin console. */
export default async function LegacyWorkflowsRedirect({
  params,
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params
  const tail = slug?.length ? `/${slug.join("/")}` : ""
  redirect(`/admin/workflows${tail}`)
}
