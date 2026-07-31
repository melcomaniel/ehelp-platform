-- Unique claim tokens for beneficiary disbursement QR codes.
-- Only Office Admin validates at the cash window.

ALTER TABLE disbursement_bookings
  ADD COLUMN IF NOT EXISTS claim_token TEXT,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validated_by_user_id UUID REFERENCES user_accounts(id);

UPDATE disbursement_bookings
SET claim_token = encode(gen_random_bytes(24), 'hex')
WHERE claim_token IS NULL;

ALTER TABLE disbursement_bookings
  ALTER COLUMN claim_token SET NOT NULL,
  ALTER COLUMN claim_token SET DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS disbursement_bookings_claim_token_uidx
  ON disbursement_bookings (claim_token);
