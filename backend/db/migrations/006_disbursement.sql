-- ═══════════════════════════════════════════
-- DISBURSEMENT
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS disbursement_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
  channel TEXT NOT NULL
    CHECK (channel IN ('landbank', 'ewallet', 'digital_bank', 'cash_pickup')),
  account_ref_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'active', 'disabled')),
  identity_verified_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disbursement_methods_beneficiary_idx
  ON disbursement_methods (beneficiary_id);

CREATE TABLE IF NOT EXISTS disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL UNIQUE REFERENCES applications(id),
  disbursement_method_id UUID REFERENCES disbursement_methods(id),
  amount NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'authorized', 'released', 'failed', 'reversed')),
  qr_payload_hash TEXT,
  provider_ref TEXT,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disbursements_method_idx ON disbursements (disbursement_method_id);

CREATE TABLE IF NOT EXISTS disbursement_auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  disbursement_id UUID NOT NULL REFERENCES disbursements(id) ON DELETE CASCADE,
  auth_factor TEXT NOT NULL
    CHECK (auth_factor IN ('qr', 'face', 'pin')),
  result TEXT NOT NULL
    CHECK (result IN ('success', 'fail')),
  face_match_audit JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disbursement_auth_events_disbursement_idx
  ON disbursement_auth_events (disbursement_id);
