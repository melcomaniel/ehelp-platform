-- ═══════════════════════════════════════════
-- WORKFLOW TEMPLATES (reusable blueprints)
-- Program versions own a copied engine instance (1:1).
-- A template may be reused to spawn engines for other programs;
-- the same engine row is never shared across programs.
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS workflow_templates_org_idx
  ON workflow_templates (organization_id);

CREATE TABLE IF NOT EXISTS workflow_template_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id UUID NOT NULL
    REFERENCES workflow_templates(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_type TEXT NOT NULL
    CHECK (step_type IN ('evaluation', 'approval', 'disbursement')),
  assignment_strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
  timeout INTERVAL,
  escalation_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workflow_template_id, step_key)
);

CREATE INDEX IF NOT EXISTS workflow_template_steps_template_idx
  ON workflow_template_steps (workflow_template_id);

ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS source_workflow_template_id UUID
    REFERENCES workflow_templates(id);

CREATE INDEX IF NOT EXISTS workflow_definitions_source_template_idx
  ON workflow_definitions (source_workflow_template_id);
