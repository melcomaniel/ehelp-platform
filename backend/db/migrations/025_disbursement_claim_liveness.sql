-- Face liveness at cash-window claim validation (for future face match).

ALTER TABLE disbursement_bookings
  ADD COLUMN IF NOT EXISTS liveness_session_id UUID
    REFERENCES liveness_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS disbursement_bookings_liveness_session_idx
  ON disbursement_bookings (liveness_session_id)
  WHERE liveness_session_id IS NOT NULL;
