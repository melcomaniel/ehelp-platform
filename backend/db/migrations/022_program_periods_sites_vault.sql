-- Program period windows live in disbursement_rules.period_windows (JSONB).
-- Office / slot map pins + beneficiary document vault.

ALTER TABLE offices
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS map_label TEXT;

ALTER TABLE disbursement_slots
  ADD COLUMN IF NOT EXISTS site_name TEXT,
  ADD COLUMN IF NOT EXISTS site_address TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS beneficiary_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  storage_uri TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beneficiary_documents_beneficiary_idx
  ON beneficiary_documents (beneficiary_id);
CREATE INDEX IF NOT EXISTS beneficiary_documents_type_idx
  ON beneficiary_documents (document_type);
