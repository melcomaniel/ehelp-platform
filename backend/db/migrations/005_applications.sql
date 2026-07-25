-- ═══════════════════════════════════════════
-- APPLICATIONS & DECISIONS
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  office_id UUID NOT NULL REFERENCES offices(id),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  program_template_version_id UUID NOT NULL
    REFERENCES program_template_versions(id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'submitted', 'in_evaluation', 'in_approval',
      'approved', 'rejected', 'disbursed', 'cancelled'
    )),
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applications_org_idx ON applications (organization_id);
CREATE INDEX IF NOT EXISTS applications_office_idx ON applications (office_id);
CREATE INDEX IF NOT EXISTS applications_beneficiary_idx ON applications (beneficiary_id);
CREATE INDEX IF NOT EXISTS applications_version_idx ON applications (program_template_version_id);
CREATE INDEX IF NOT EXISTS applications_status_idx ON applications (status);

CREATE TABLE IF NOT EXISTS application_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  form_field_id UUID NOT NULL REFERENCES form_fields(id),
  value JSONB NOT NULL DEFAULT 'null'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, form_field_id)
);

CREATE INDEX IF NOT EXISTS application_answers_application_idx
  ON application_answers (application_id);

CREATE TABLE IF NOT EXISTS application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  storage_uri TEXT NOT NULL,
  captured_offline BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_documents_application_idx
  ON application_documents (application_id);

CREATE TABLE IF NOT EXISTS rule_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES rules(id),
  result TEXT NOT NULL
    CHECK (result IN ('pass', 'fail', 'warn')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rule_evaluations_application_idx
  ON rule_evaluations (application_id);

CREATE TABLE IF NOT EXISTS workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  workflow_step_id UUID NOT NULL REFERENCES workflow_steps(id),
  assignee_user_id UUID REFERENCES user_accounts(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'escalated', 'timed_out')),
  decision TEXT
    CHECK (decision IS NULL OR decision IN ('endorse', 'approve', 'reject')),
  notes TEXT,
  endorsed_by_assignee BOOLEAN NOT NULL DEFAULT false,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_tasks_application_idx ON workflow_tasks (application_id);
CREATE INDEX IF NOT EXISTS workflow_tasks_assignee_idx ON workflow_tasks (assignee_user_id);
CREATE INDEX IF NOT EXISTS workflow_tasks_step_idx ON workflow_tasks (workflow_step_id);
