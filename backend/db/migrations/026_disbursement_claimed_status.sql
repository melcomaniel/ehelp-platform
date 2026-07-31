-- Terminal cash-window claim: application + booking status "claimed",
-- with a durable claim record (incl. face liveness for future face match).

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications
  ADD CONSTRAINT applications_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,
    'submitted'::text,
    'in_evaluation'::text,
    'in_approval'::text,
    'approved'::text,
    'rejected'::text,
    'disbursed'::text,
    'claimed'::text,
    'cancelled'::text
  ]));

ALTER TABLE disbursement_bookings DROP CONSTRAINT IF EXISTS disbursement_bookings_status_check;
ALTER TABLE disbursement_bookings
  ADD CONSTRAINT disbursement_bookings_status_check
  CHECK (status = ANY (ARRAY[
    'booked'::text,
    'cancelled'::text,
    'completed'::text,
    'claimed'::text,
    'no_show'::text
  ]));

CREATE TABLE IF NOT EXISTS disbursement_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES disbursement_bookings(id),
  application_id UUID NOT NULL REFERENCES applications(id),
  beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  office_id UUID NOT NULL REFERENCES offices(id),
  claimed_by_user_id UUID NOT NULL REFERENCES user_accounts(id),
  liveness_session_id UUID REFERENCES liveness_sessions(id) ON DELETE SET NULL,
  claim_token TEXT NOT NULL,
  queue_number INTEGER NOT NULL CHECK (queue_number > 0),
  reference_no TEXT,
  beneficiary_name TEXT NOT NULL,
  beneficiary_phone TEXT,
  slot_starts_at TIMESTAMPTZ NOT NULL,
  slot_ends_at TIMESTAMPTZ NOT NULL,
  site_name TEXT,
  site_address TEXT,
  -- Live capture at claim time; face match vs PhilSys/enrollment later.
  face_liveness JSONB NOT NULL DEFAULT '{}'::jsonb,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS disbursement_claims_application_idx
  ON disbursement_claims (application_id);
CREATE INDEX IF NOT EXISTS disbursement_claims_beneficiary_idx
  ON disbursement_claims (beneficiary_id);
CREATE INDEX IF NOT EXISTS disbursement_claims_office_idx
  ON disbursement_claims (office_id, claimed_at DESC);
CREATE INDEX IF NOT EXISTS disbursement_claims_liveness_idx
  ON disbursement_claims (liveness_session_id)
  WHERE liveness_session_id IS NOT NULL;

-- Promote already-validated cash-window completions to claimed.
UPDATE disbursement_bookings
SET status = 'claimed', updated_at = now()
WHERE status = 'completed' AND validated_at IS NOT NULL;

UPDATE applications a
SET status = 'claimed', updated_at = now()
FROM disbursement_bookings b
WHERE b.application_id = a.id
  AND b.status = 'claimed'
  AND a.status = 'disbursed';
