import { Skeleton } from "@/components/ui/skeleton"

export default function LoadingOrganizations() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}
