-- ═══════════════════════════════════════════
-- RELATIONSHIPS (max 3 active per beneficiary)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  requester_beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  related_beneficiary_id UUID NOT NULL REFERENCES beneficiaries(id),
  type TEXT NOT NULL
    CHECK (type IN (
      'parent', 'child', 'guardian', 'dependent',
      'guarantor', 'authorized_representative'
    )),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested', 'validated', 'approved', 'rejected', 'revoked'
    )),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requester_beneficiary_id <> related_beneficiary_id)
);

CREATE INDEX IF NOT EXISTS relationships_org_idx ON relationships (organization_id);
CREATE INDEX IF NOT EXISTS relationships_requester_idx ON relationships (requester_beneficiary_id);
CREATE INDEX IF NOT EXISTS relationships_related_idx ON relationships (related_beneficiary_id);

-- Enforce max 3 active (validated|approved) relationships per requester
CREATE OR REPLACE FUNCTION enforce_max_active_relationships()
RETURNS TRIGGER AS $$
DECLARE
  active_count INT;
BEGIN
  IF NEW.status IN ('validated', 'approved') THEN
    SELECT COUNT(*) INTO active_count
    FROM relationships
    WHERE requester_beneficiary_id = NEW.requester_beneficiary_id
      AND status IN ('validated', 'approved')
      AND id IS DISTINCT FROM NEW.id;
    IF active_count >= 3 THEN
      RAISE EXCEPTION 'beneficiary % already has 3 active relationships',
        NEW.requester_beneficiary_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_max_active_relationships ON relationships;
CREATE TRIGGER trg_max_active_relationships
  BEFORE INSERT OR UPDATE OF status ON relationships
  FOR EACH ROW EXECUTE FUNCTION enforce_max_active_relationships();

CREATE TABLE IF NOT EXISTS relationship_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  storage_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS relationship_documents_relationship_idx
  ON relationship_documents (relationship_id);

CREATE TABLE IF NOT EXISTS relationship_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,
  evaluator_id UUID REFERENCES user_accounts(id),
  approver_id UUID REFERENCES user_accounts(id),
  stage TEXT NOT NULL
    CHECK (stage IN ('evaluation', 'approval')),
  decision TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS relationship_reviews_relationship_idx
  ON relationship_reviews (relationship_id);
