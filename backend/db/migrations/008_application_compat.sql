-- Practical columns for mobile API compatibility
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS reference_no TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS applications_reference_no_uidx
  ON applications (reference_no)
  WHERE reference_no IS NOT NULL;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS amount_requested NUMERIC(14, 2);

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS amount_approved NUMERIC(14, 2);

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS evaluator_notes TEXT;

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS approver_notes TEXT;
