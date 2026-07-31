"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { getProgramTemplate, type ProgramTemplateRow } from "@/lib/admin/template-actions";
import {
  DataTable,
  EmptyState,
  PageHeader,
  StatusPill,
  Td,
} from "@/components/ehelp/bits";
import { usePrompts } from "@/components/workflow/prompts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { stepsOf } from "@/lib/workflow/engine";
import {
  getBuilderProgramIdForNest,
  linkNestProgramToBuilder,
} from "@/lib/workflow/nest-program-link";
import {
  exportApplicantWorkflow,
  syncApplicantWorkflowToNest,
} from "@/lib/workflow/sync-applicant-workflow";
import { useWorkflow } from "@/lib/workflow/store";
import { CLASSIFICATION_LABEL } from "@/lib/workflow/types";
import {
  ArrowLeftIcon,
  GitBranchPlusIcon,
  PencilRulerIcon,
  UploadIcon,
} from "lucide-react";

/**
 * Nest program detail → Workflow Builder pipeline
 * (Form → Identity Verify → Review → Disbursement), not Nest evaluation/approval attach.
 */
export default function ProgramDetailPage() {
  const { id: nestId } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    state,
    createProgram,
    publishVersion,
    createDraftFromPublished,
  } = useWorkflow();
  const { toast, confirm } = usePrompts();

  const [nestProgram, setNestProgram] =
    React.useState<ProgramTemplateRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [templateId, setTemplateId] = React.useState("");
  const linkingRef = React.useRef(false);

  const publishedTemplates = React.useMemo(
    () => state.templates.filter((t) => t.status === "published"),
    [state.templates],
  );

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const p = await getProgramTemplate(nestId);
        if (!cancelled) setNestProgram(p);
      } catch (e) {
        if (!cancelled) {
          setNestProgram(null);
          setError(e instanceof Error ? e.message : "Failed to load program");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nestId]);

  React.useEffect(() => {
    if (!publishedTemplates.length) return;
    setTemplateId((prev) => {
      if (prev && publishedTemplates.some((t) => t.id === prev)) return prev;
      const basic = publishedTemplates.find((t) =>
        t.name.toLowerCase().includes("basic"),
      );
      return basic?.id ?? publishedTemplates[0]!.id;
    });
  }, [publishedTemplates]);

  const [linkedBuilderId, setLinkedBuilderId] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    setLinkedBuilderId(getBuilderProgramIdForNest(nestId));
  }, [nestId]);

  const builderProgram = linkedBuilderId
    ? state.programs.find((p) => p.id === linkedBuilderId)
    : null;

  /** Prefer an existing local program with the same name (e.g. seed PRG-*). */
  React.useEffect(() => {
    if (!nestProgram || linkedBuilderId) return;
    const byName = state.programs.find(
      (p) =>
        p.name.trim().toLowerCase() === nestProgram.name.trim().toLowerCase(),
    );
    if (byName) {
      linkNestProgramToBuilder(nestId, byName.id);
      setLinkedBuilderId(byName.id);
    }
  }, [nestProgram, linkedBuilderId, nestId, state.programs]);

  const ensureBuilderProgram = React.useCallback(
    (fromTemplateId: string | null) => {
      if (linkedBuilderId && state.programs.some((p) => p.id === linkedBuilderId)) {
        return linkedBuilderId;
      }
      if (linkingRef.current) return null;
      linkingRef.current = true;
      const result = createProgram({
        name: nestProgram?.name ?? "Program",
        description: nestProgram?.description ?? "",
        classification: "simple",
        templateId: fromTemplateId,
      });
      linkingRef.current = false;
      if (!result.ok || !("id" in result) || !result.id) {
        toast({
          title: "Could not open workflow builder",
          description: result.error ?? "Unknown error",
          variant: "error",
        });
        return null;
      }
      linkNestProgramToBuilder(nestId, result.id);
      setLinkedBuilderId(result.id);
      return result.id;
    },
    [linkedBuilderId, state.programs, createProgram, nestId, nestProgram, toast],
  );

  const openBuilder = (versionId?: string) => {
    const prgId =
      builderProgram?.id ??
      ensureBuilderProgram(templateId || null);
    if (!prgId) return;
    const q = versionId ? `?version=${versionId}` : "";
    router.push(`/admin/programs/${prgId}/builder${q}`);
  };

  const syncLinkedWorkflowToNest = React.useCallback(
    async (stepSetId: string) => {
      const payload = exportApplicantWorkflow(state, stepSetId);
      const sync = await syncApplicantWorkflowToNest(nestId, payload);
      if (!sync.ok) {
        toast({
          title: "Saved locally, but mobile sync failed",
          description: sync.error,
          variant: "error",
        });
        return false;
      }
      return true;
    },
    [state, nestId, toast],
  );

  const applyPublishedWorkflow = async () => {
    if (!templateId) {
      toast({
        title: "Pick a workflow",
        description:
          "Publish a workflow under Workflows first (Form → Verify → Review → Disbursement).",
        variant: "error",
      });
      return;
    }
    const template = state.templates.find((t) => t.id === templateId);
    if (!template) return;

    const result = createProgram({
      name: nestProgram?.name ?? builderProgram?.name ?? "Program",
      description:
        nestProgram?.description ?? builderProgram?.description ?? "",
      classification: "simple",
      templateId,
    });
    if (!result.ok || !result.id) {
      toast({
        title: "Could not apply workflow",
        description: result.error,
        variant: "error",
      });
      return;
    }
    linkNestProgramToBuilder(nestId, result.id);
    setLinkedBuilderId(result.id);

    const synced = await syncLinkedWorkflowToNest(template.stepSetId);
    toast({
      title: synced ? "Workflow applied & synced to mobile" : "Workflow applied",
      description: synced
        ? "Stages and form fields are available on Nest for the app."
        : "Open the builder, then Publish to retry mobile sync.",
      variant: synced ? "success" : "error",
    });
    router.push(`/admin/programs/${result.id}/builder`);
  };

  const versions = builderProgram
    ? state.versions
        .filter((v) => v.programId === builderProgram.id)
        .sort((a, b) => b.versionNo - a.versionNo)
    : [];

  const provenance = builderProgram?.createdFromTemplateId
    ? state.templates.find((t) => t.id === builderProgram.createdFromTemplateId)
    : null;

  const versionSignature = versions.map((v) => `${v.id}:${v.status}`).join("|");

  // Keep Nest/mobile in sync with the linked builder pipeline whenever this page loads.
  React.useEffect(() => {
    if (!builderProgram || !versions[0]) return;
    const latest =
      versions.find((v) => v.status === "published") ??
      versions.find((v) => v.status === "draft") ??
      versions[0];
    let cancelled = false;
    void (async () => {
      const payload = exportApplicantWorkflow(state, latest.stepSetId);
      const sync = await syncApplicantWorkflowToNest(nestId, payload);
      if (!cancelled && !sync.ok) {
        console.warn("Auto sync applicant workflow failed:", sync.error);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when link/versions change
  }, [builderProgram?.id, versionSignature, nestId]);

  if (loading) {
    return (
      <EmptyState
        title="Loading program…"
        description="Fetching program and workflow builder link."
      />
    );
  }

  if (!nestProgram) {
    return (
      <EmptyState
        title="Program not found"
        description={error ?? "It may have been removed."}
      />
    );
  }

  const onPublish = async (versionId: string, versionNo: number) => {
    const ok = await confirm({
      title: `Publish version ${versionNo}?`,
      description:
        "Publishing freezes this version — its steps and fields can no longer be edited.",
      confirmLabel: "Publish",
    });
    if (!ok) return;
    const version = versions.find((v) => v.id === versionId);
    const result = publishVersion(versionId);
    if (!result.ok || !version) {
      toast({
        title: "Could not publish",
        description: result.error,
        variant: "error",
      });
      return;
    }
    const synced = await syncLinkedWorkflowToNest(version.stepSetId);
    toast({
      title: `Version ${versionNo} published`,
      description: synced
        ? "Synced to mobile."
        : "Published locally; use Sync to mobile if the app still shows the old form.",
      variant: synced ? "success" : "error",
    });
  };

  const onNewDraft = () => {
    if (!builderProgram) return;
    const result = createDraftFromPublished(builderProgram.id);
    toast(
      result.ok
        ? {
            title: "Draft created",
            description: "Open the builder to edit the new draft.",
            variant: "success",
          }
        : {
            title: "Could not create draft",
            description: result.error,
            variant: "error",
          },
    );
  };

  return (
    <>
      <PageHeader
        title={nestProgram.name}
        description={
          nestProgram.description ||
          "Applicant journey: Form → Face Verification → Review → Disbursement."
        }
      >
        <Button size="sm" variant="ghost" render={<Link href="/admin/programs" />}>
          <ArrowLeftIcon /> Programs
        </Button>
      </PageHeader>

      <div className="grid gap-4 text-sm sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Cooldown</CardDescription>
            <CardTitle className="text-sm tabular-nums">
              {nestProgram.cooldownDays} days
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Assigned workflow</CardDescription>
            <CardTitle className="text-sm">
              {provenance?.name ??
                (builderProgram ? "Custom pipeline" : "Not linked yet")}
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {CLASSIFICATION_LABEL.simple}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Nest status</CardDescription>
            <CardTitle className="text-sm">
              <StatusPill
                value={nestProgram.isActive ? "published" : "draft"}
              />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applicant workflow (builder)</CardTitle>
          <CardDescription>
            This is the Form → Identity Verify → Review → Disbursement pipeline
            from <strong>Workflows</strong> — not the staff evaluation/approval
            engine. Pick a published workflow (e.g. Basic Workflow), apply it,
            then open the builder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Published workflow template
              </label>
              <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                {publishedTemplates.length === 0 ? (
                  <option value="">No published workflows — create one under Workflows</option>
                ) : (
                  publishedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <Button
              size="sm"
              disabled={!templateId}
              onClick={() => void applyPublishedWorkflow()}
            >
              {builderProgram ? "Apply to new draft" : "Connect & open builder"}
            </Button>
            {builderProgram && (
              <Button size="sm" variant="outline" onClick={() => openBuilder()}>
                <PencilRulerIcon /> Open builder
              </Button>
            )}
            {builderProgram && versions[0] && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const draftOrLatest =
                    versions.find((v) => v.status === "draft") ?? versions[0];
                  const ok = await syncLinkedWorkflowToNest(
                    draftOrLatest.stepSetId,
                  );
                  if (ok) {
                    toast({
                      title: "Synced to mobile",
                      description:
                        "Applicants will see this program’s stages and form fields.",
                      variant: "success",
                    });
                  }
                }}
              >
                Sync to mobile
              </Button>
            )}
          </div>

          {publishedTemplates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Go to{" "}
              <Link href="/admin/workflows" className="underline">
                Workflows
              </Link>
              , create <em>Basic Workflow</em> (Form, Face Verification, Review,
              Disbursement), publish it, then return here.
            </p>
          )}
        </CardContent>
      </Card>

      {builderProgram && (
        <Card>
          <CardHeader>
            <CardTitle>Versions</CardTitle>
            <CardDescription>
              Publish freezes a version; editing published steps requires a new
              draft
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              headers={["Version", "Status", "Steps", "Published", "Actions"]}
              empty={versions.length === 0}
            >
              {versions.map((v) => {
                const steps = stepsOf(state, v.stepSetId);
                return (
                  <tr key={v.id} className="border-b last:border-0">
                    <Td className="tabular-nums">v{v.versionNo}</Td>
                    <Td>
                      <StatusPill value={v.status} />
                    </Td>
                    <Td className="text-xs text-muted-foreground">
                      {steps.length === 0
                        ? "—"
                        : steps.map((s) => s.name).join(" → ")}
                    </Td>
                    <Td className="text-xs text-muted-foreground">
                      {v.publishedAt
                        ? new Date(v.publishedAt).toLocaleDateString()
                        : "—"}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openBuilder(v.id)}
                        >
                          <PencilRulerIcon />{" "}
                          {v.status === "draft" ? "Edit in builder" : "View"}
                        </Button>
                        {v.status === "draft" && (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => void onPublish(v.id, v.versionNo)}
                          >
                            <UploadIcon /> Publish
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </DataTable>
            {versions.some((v) => v.status === "published") &&
              !versions.some((v) => v.status === "draft") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={onNewDraft}
                >
                  <GitBranchPlusIcon /> New draft from published
                </Button>
              )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
