-- ═══════════════════════════════════════════
-- TENANCY & ORG STRUCTURE + IDENTITY
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  policy_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS offices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  parent_office_id UUID REFERENCES offices(id),
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'municipal'
    CHECK (level IN ('central', 'regional', 'provincial', 'municipal')),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS offices_organization_id_idx ON offices (organization_id);
CREATE INDEX IF NOT EXISTS offices_parent_office_id_idx ON offices (parent_office_id);

-- Beneficiaries first (user_accounts may FK to them)
CREATE TABLE IF NOT EXISTS beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  national_id_hash TEXT UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  date_of_birth DATE,
  pin_hash TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'verified', 'manual_review')),
  active_relationship_count INT NOT NULL DEFAULT 0
    CHECK (active_relationship_count >= 0 AND active_relationship_count <= 3),
  -- Auth / SSO profile fields (practical bridge for Nest MVP)
  egov_uniqid TEXT UNIQUE,
  phone TEXT,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  suffix TEXT,
  gender TEXT,
  nationality TEXT,
  address TEXT,
  street TEXT,
  barangay TEXT,
  municipality TEXT,
  photo_url TEXT,
  face_scan_verified BOOLEAN NOT NULL DEFAULT false,
  face_scan_url TEXT,
  pin_expires_at TIMESTAMPTZ,
  validation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (validation_status IN ('pending', 'validated', 'rejected')),
  everify_reference TEXT,
  everify_verified_at TIMESTAMPTZ,
  profile_locked BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS beneficiaries_egov_uniqid_idx ON beneficiaries (egov_uniqid);

CREATE TABLE IF NOT EXISTS user_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  office_id UUID REFERENCES offices(id),
  beneficiary_id UUID UNIQUE REFERENCES beneficiaries(id),
  account_type TEXT NOT NULL
    CHECK (account_type IN ('platform_admin', 'staff', 'beneficiary')),
  email TEXT UNIQUE,
  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_accounts_organization_id_idx ON user_accounts (organization_id);
CREATE INDEX IF NOT EXISTS user_accounts_office_id_idx ON user_accounts (office_id);
CREATE INDEX IF NOT EXISTS user_accounts_beneficiary_id_idx ON user_accounts (beneficiary_id);
CREATE INDEX IF NOT EXISTS user_accounts_email_idx ON user_accounts (email);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE
    CHECK (code IN (
      'PLATFORM_ADMIN', 'ORG_ADMIN', 'OFFICE_ADMIN',
      'EVALUATOR', 'APPROVER', 'BENEFICIARY', 'DEPENDENT'
    )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id),
  office_id UUID REFERENCES offices(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_account_id, role_id, office_id)
);

CREATE INDEX IF NOT EXISTS user_role_assignments_user_idx ON user_role_assignments (user_account_id);
CREATE INDEX IF NOT EXISTS user_role_assignments_role_idx ON user_role_assignments (role_id);

CREATE TABLE IF NOT EXISTS device_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'revoked')),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_registrations_user_idx ON device_registrations (user_account_id);

CREATE TABLE IF NOT EXISTS login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  method TEXT NOT NULL
    CHECK (method IN ('pin', 'otp', 'face', 'password')),
  result TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_events_user_idx ON login_events (user_account_id);

CREATE TABLE IF NOT EXISTS biometric_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
  modality TEXT NOT NULL DEFAULT 'face'
    CHECK (modality IN ('face')),
  template_encrypted BYTEA,
  status TEXT NOT NULL DEFAULT 'active',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS biometric_enrollments_beneficiary_idx ON biometric_enrollments (beneficiary_id);

CREATE TABLE IF NOT EXISTS national_id_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id) ON DELETE CASCADE,
  provider_ref TEXT,
  result TEXT NOT NULL
    CHECK (result IN ('matched', 'failed', 'manual')),
  raw_response_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS national_id_verifications_beneficiary_idx
  ON national_id_verifications (beneficiary_id);

-- Auth runtime: mid-flow liveness sessions (not in ERD diagram; Nest needs them)
CREATE TABLE IF NOT EXISTS liveness_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL,
  session_token TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'registration',
  status TEXT NOT NULL DEFAULT 'pending',
  confidence_score NUMERIC,
  reference_image_url TEXT,
  provider_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS liveness_sessions_user_idx ON liveness_sessions (user_account_id);

-- Auth runtime: refresh tokens (not in ERD; Nest JWT refresh)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_account_id);
