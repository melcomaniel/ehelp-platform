-- Tie disbursement calendar slots to a program so scheduling
-- respects that program's period_windows.disbursement_* range.

ALTER TABLE disbursement_slots
  ADD COLUMN IF NOT EXISTS program_template_id UUID
    REFERENCES program_templates(id);

CREATE INDEX IF NOT EXISTS disbursement_slots_program_idx
  ON disbursement_slots (program_template_id, starts_at);
