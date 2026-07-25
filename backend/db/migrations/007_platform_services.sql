-- ═══════════════════════════════════════════
-- NOTIFICATIONS, AI ADVISORY, OFFLINE, AUDIT
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  channel TEXT NOT NULL
    CHECK (channel IN ('sms', 'in_app', 'device')),
  event_type TEXT NOT NULL
    CHECK (event_type IN ('outcome', 'status', 'otp', 'other')),
  mandatory BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_account_id);
CREATE INDEX IF NOT EXISTS notifications_application_idx ON notifications (application_id);
CREATE INDEX IF NOT EXISTS notifications_org_idx ON notifications (organization_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL
    CHECK (channel IN ('in_app', 'device')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_account_id, channel)
);

CREATE TABLE IF NOT EXISTS ai_advisory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  user_account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  advisory_type TEXT NOT NULL
    CHECK (advisory_type IN (
      'program_rec', 'eligibility_explain', 'workflow_guide', 'faq'
    )),
  prompt_redacted TEXT,
  response_redacted TEXT,
  decision_influence_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_advisory_events_user_idx ON ai_advisory_events (user_account_id);
CREATE INDEX IF NOT EXISTS ai_advisory_events_application_idx ON ai_advisory_events (application_id);

CREATE TABLE IF NOT EXISTS offline_sync_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  client_device_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'partial', 'rejected')),
  conflict_strategy TEXT NOT NULL DEFAULT 'server_authoritative'
    CHECK (conflict_strategy IN ('server_authoritative')),
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offline_sync_batches_user_idx ON offline_sync_batches (user_account_id);

CREATE TABLE IF NOT EXISTS offline_sync_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_batch_id UUID NOT NULL REFERENCES offline_sync_batches(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL
    CHECK (entity_type IN ('registration', 'evaluation', 'document', 'form')),
  client_mutation_id TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  apply_result TEXT
    CHECK (apply_result IS NULL OR apply_result IN ('accepted', 'overridden', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offline_sync_items_batch_idx ON offline_sync_items (sync_batch_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  actor_user_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL,
  action TEXT NOT NULL
    CHECK (action IN (
      'registration', 'verification', 'evaluation', 'approval',
      'rejection', 'disbursement', 'relationship', 'login'
    )),
  entity_type TEXT,
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_org_idx ON audit_logs (organization_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_occurred_idx ON audit_logs (occurred_at);
