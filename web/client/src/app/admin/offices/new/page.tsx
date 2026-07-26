"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAdminAccess } from "@/lib/admin/access-provider";
import {
  OFFICE_LEVEL_LABEL,
  createOffice,
  listParentOfficeOptions,
  type OfficeLevel,
  type ParentOfficeOption,
} from "@/lib/admin/offices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftIcon, LandmarkIcon } from "lucide-react";

export default function NewOfficePage() {
  const router = useRouter();
  const { profile, loading: accessLoading } = useAdminAccess();
  const isOrgAdmin = profile?.role === "dswd_admin";
  const [parents, setParents] = React.useState<ParentOfficeOption[]>([]);
  const [loadingParents, setLoadingParents] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!accessLoading && isOrgAdmin) {
      void listParentOfficeOptions()
        .then((result) => setParents(result.data))
        .catch((caught) =>
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load parent offices",
          ),
        )
        .finally(() => setLoadingParents(false));
    }
  }, [accessLoading, isOrgAdmin]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const parentOfficeId = String(data.get("parent_office_id") ?? "");
    try {
      const office = await createOffice({
        name: String(data.get("name") ?? ""),
        code: String(data.get("code") ?? ""),
        level: String(data.get("level") ?? "municipal") as OfficeLevel,
        parent_office_id: parentOfficeId || null,
      });
      router.push(`/admin/offices/${office.id}?created=1`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create office",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (accessLoading) return <Skeleton className="h-80 w-full" />;
  if (!isOrgAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Forbidden</CardTitle>
        </CardHeader>
        <CardContent>
          Organization Administrator access is required.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <Button variant="ghost" render={<Link href="/admin/offices" />}>
          <ArrowLeftIcon /> Offices
        </Button>
        <div className="mt-3 flex items-start gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
            <LandmarkIcon />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Add office</h1>
            <p className="text-sm text-muted-foreground">
              The office will be created inside your organization.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Office information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Office name</Label>
              <Input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={160}
                placeholder="DSWD CAR Regional Office"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Office code</Label>
              <Input
                id="code"
                name="code"
                required
                maxLength={40}
                placeholder="CAR"
                className="uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="level">Office type</Label>
              <select
                id="level"
                name="level"
                required
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                defaultValue="municipal"
              >
                {Object.entries(OFFICE_LEVEL_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="parent_office_id">Parent office</Label>
              <select
                id="parent_office_id"
                name="parent_office_id"
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                disabled={loadingParents}
              >
                <option value="">No parent office</option>
                {parents.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.name} ({office.code})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {error && (
          <p
            className="rounded-md border border-destructive bg-destructive/5 p-3 text-sm"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" render={<Link href="/admin/offices" />}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || loadingParents}>
            {submitting ? "Creating..." : "Create office"}
          </Button>
        </div>
      </form>
    </div>
  );
}
