-- ═══════════════════════════════════════════
-- Profile change requests (office-mediated)
-- Disbursement calendar slots + bookings
-- Notification message body columns
-- ═══════════════════════════════════════════

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS profile_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  office_id UUID REFERENCES offices(id),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  requested_by_user_id UUID NOT NULL REFERENCES user_accounts(id),
  description TEXT NOT NULL,
  proposed_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by_user_id UUID REFERENCES user_accounts(id),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_change_requests_beneficiary_idx
  ON profile_change_requests (beneficiary_id);
CREATE INDEX IF NOT EXISTS profile_change_requests_status_idx
  ON profile_change_requests (status);
CREATE INDEX IF NOT EXISTS profile_change_requests_org_idx
  ON profile_change_requests (organization_id);

CREATE TABLE IF NOT EXISTS profile_change_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES profile_change_requests(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  storage_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_change_documents_request_idx
  ON profile_change_documents (request_id);

-- Only one pending change request per beneficiary
CREATE UNIQUE INDEX IF NOT EXISTS profile_change_requests_one_pending_idx
  ON profile_change_requests (beneficiary_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS disbursement_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  office_id UUID NOT NULL REFERENCES offices(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL DEFAULT 10 CHECK (capacity > 0),
  booked_count INT NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  label TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'cancelled')),
  created_by_user_id UUID REFERENCES user_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (booked_count <= capacity)
);

CREATE INDEX IF NOT EXISTS disbursement_slots_office_starts_idx
  ON disbursement_slots (office_id, starts_at);
CREATE INDEX IF NOT EXISTS disbursement_slots_status_idx
  ON disbursement_slots (status);

CREATE TABLE IF NOT EXISTS disbursement_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES disbursement_slots(id),
  application_id UUID NOT NULL REFERENCES applications(id),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  user_account_id UUID NOT NULL REFERENCES user_accounts(id),
  queue_number INT NOT NULL CHECK (queue_number > 0),
  status TEXT NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked', 'cancelled', 'completed', 'no_show')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id)
);

CREATE INDEX IF NOT EXISTS disbursement_bookings_slot_idx
  ON disbursement_bookings (slot_id);
CREATE INDEX IF NOT EXISTS disbursement_bookings_user_idx
  ON disbursement_bookings (user_account_id);

-- One active booking per slot+beneficiary
CREATE UNIQUE INDEX IF NOT EXISTS disbursement_bookings_active_slot_ben_idx
  ON disbursement_bookings (slot_id, beneficiary_id)
  WHERE status = 'booked';
