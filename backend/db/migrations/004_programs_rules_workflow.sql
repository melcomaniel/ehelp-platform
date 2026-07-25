-- ═══════════════════════════════════════════
-- PROGRAM TEMPLATES, FORMS, WORKFLOW & RULES
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS program_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS program_templates_org_idx ON program_templates (organization_id);

CREATE TABLE IF NOT EXISTS program_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_template_id UUID NOT NULL REFERENCES program_templates(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  description TEXT,
  validity_start DATE,
  validity_end DATE,
  cooldown_period INTERVAL,
  disbursement_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  notification_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  immutable BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_template_id, version_number)
);

CREATE INDEX IF NOT EXISTS program_template_versions_template_idx
  ON program_template_versions (program_template_id);

CREATE TABLE IF NOT EXISTS form_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_template_version_id UUID NOT NULL UNIQUE
    REFERENCES program_template_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_definition_id UUID NOT NULL REFERENCES form_definitions(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  field_type TEXT NOT NULL
    CHECK (field_type IN (
      'text', 'number', 'date', 'dropdown', 'checkbox', 'radio',
      'file', 'signature', 'face', 'qr', 'gps', 'national_id'
    )),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (form_definition_id, field_key)
);

CREATE INDEX IF NOT EXISTS form_fields_form_idx ON form_fields (form_definition_id);

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_template_version_id UUID NOT NULL UNIQUE
    REFERENCES program_template_versions(id) ON DELETE CASCADE,
  version_number INT NOT NULL DEFAULT 1,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  step_type TEXT NOT NULL
    CHECK (step_type IN ('evaluation', 'approval', 'disbursement')),
  assignment_strategy JSONB NOT NULL DEFAULT '{}'::jsonb,
  timeout INTERVAL,
  escalation_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workflow_definition_id, step_key)
);

CREATE INDEX IF NOT EXISTS workflow_steps_workflow_idx ON workflow_steps (workflow_definition_id);

CREATE TABLE IF NOT EXISTS rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_template_version_id UUID NOT NULL UNIQUE
    REFERENCES program_template_versions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL
    CHECK (rule_type IN (
      'eligibility', 'documents', 'geo', 'cooldown', 'duplicate', 'relationship'
    )),
  expression JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'block'
    CHECK (severity IN ('block', 'warn')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rules_rule_set_idx ON rules (rule_set_id);

CREATE TABLE IF NOT EXISTS program_office_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_template_version_id UUID NOT NULL
    REFERENCES program_template_versions(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES offices(id),
  allowed_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_template_version_id, office_id)
);

CREATE INDEX IF NOT EXISTS program_office_customizations_office_idx
  ON program_office_customizations (office_id);
