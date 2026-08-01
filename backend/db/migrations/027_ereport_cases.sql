-- Local ledger of beneficiary eReport submissions (case numbers from upstream).

CREATE TABLE IF NOT EXISTS ereport_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  beneficiary_id UUID REFERENCES beneficiaries(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  case_number TEXT NOT NULL,
  category_code TEXT NOT NULL,
  report_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  region_code TEXT,
  province_code TEXT,
  municipality_code TEXT,
  barangay_code TEXT,
  upstream_mode TEXT NOT NULL DEFAULT 'live'
    CHECK (upstream_mode IN ('live', 'mock')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ereport_cases_case_number_uidx
  ON ereport_cases (case_number);

CREATE INDEX IF NOT EXISTS ereport_cases_user_idx
  ON ereport_cases (user_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ereport_cases_org_region_idx
  ON ereport_cases (organization_id, region_code, created_at DESC);
