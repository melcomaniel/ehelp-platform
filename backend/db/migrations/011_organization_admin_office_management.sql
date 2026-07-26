-- Organization Administrator office management.
-- Rollback (after rolling back application code and retaining/exporting new history):
--   DROP TRIGGER IF EXISTS enforce_office_hierarchy ON offices;
--   DROP FUNCTION IF EXISTS enforce_office_hierarchy();
--   DROP INDEX IF EXISTS offices_org_normalized_code_uidx;
--   DROP INDEX IF EXISTS offices_status_idx;
--   DROP INDEX IF EXISTS offices_org_parent_status_idx;
--   ALTER TABLE offices DROP CONSTRAINT IF EXISTS offices_status_check;
--   ALTER TABLE offices DROP CONSTRAINT IF EXISTS offices_not_self_parent_check;
--   ALTER TABLE offices DROP COLUMN IF EXISTS code,
--     DROP COLUMN IF EXISTS normalized_code, DROP COLUMN IF EXISTS archived_at,
--     DROP COLUMN IF EXISTS lifecycle_reason, DROP COLUMN IF EXISTS created_by_user_id,
--     DROP COLUMN IF EXISTS updated_by_user_id;
-- The previous audit CHECK constraint must then be restored from migration 010 if
-- an old application build is redeployed.

ALTER TABLE offices
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS normalized_code TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifecycle_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_user_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL;

UPDATE offices
SET code = upper(regexp_replace(trim(name), '[^A-Za-z0-9]+', '_', 'g')),
    normalized_code = upper(regexp_replace(trim(name), '[^A-Za-z0-9]+', '_', 'g'))
WHERE code IS NULL OR normalized_code IS NULL;

UPDATE offices
SET code = concat('OFFICE_', left(id::text, 8)),
    normalized_code = concat('OFFICE_', left(id::text, 8))
WHERE code = '' OR normalized_code = '';

ALTER TABLE offices
  ALTER COLUMN code SET NOT NULL,
  ALTER COLUMN normalized_code SET NOT NULL;

ALTER TABLE offices
  DROP CONSTRAINT IF EXISTS offices_status_check;

ALTER TABLE offices
  DROP CONSTRAINT IF EXISTS offices_not_self_parent_check;

ALTER TABLE offices
  ADD CONSTRAINT offices_status_check
    CHECK (status IN ('active', 'archived')),
  ADD CONSTRAINT offices_not_self_parent_check
    CHECK (parent_office_id IS NULL OR parent_office_id <> id);

CREATE UNIQUE INDEX IF NOT EXISTS offices_org_normalized_code_uidx
  ON offices (organization_id, normalized_code);

CREATE INDEX IF NOT EXISTS offices_status_idx ON offices (status);
CREATE INDEX IF NOT EXISTS offices_org_parent_status_idx
  ON offices (organization_id, parent_office_id, status);

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_action_check
    CHECK (action IN (
      'registration', 'verification', 'evaluation', 'approval',
      'rejection', 'disbursement', 'relationship', 'login',
      'organization_created', 'organization_updated',
      'organization_suspended', 'organization_reactivated',
      'organization_archived', 'organization_admin_created',
      'organization_admin_updated', 'organization_admin_suspended',
      'role_assigned', 'invitation_created', 'invitation_accepted',
      'office_created', 'office_updated', 'office_parent_changed',
      'office_archived', 'office_reactivated'
    ));

CREATE OR REPLACE FUNCTION enforce_office_hierarchy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_org UUID;
  cycle_found BOOLEAN;
BEGIN
  IF NEW.parent_office_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_office_id = NEW.id THEN
    RAISE EXCEPTION 'Office cannot be its own parent';
  END IF;

  SELECT organization_id INTO parent_org
  FROM offices
  WHERE id = NEW.parent_office_id;

  IF parent_org IS NULL THEN
    RAISE EXCEPTION 'Parent office does not exist';
  END IF;

  IF parent_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Parent office must belong to the same organization';
  END IF;

  WITH RECURSIVE descendants AS (
    SELECT id, parent_office_id
    FROM offices
    WHERE parent_office_id = NEW.id
    UNION ALL
    SELECT child.id, child.parent_office_id
    FROM offices child
    JOIN descendants d ON child.parent_office_id = d.id
  )
  SELECT EXISTS (SELECT 1 FROM descendants WHERE id = NEW.parent_office_id)
    INTO cycle_found;

  IF cycle_found THEN
    RAISE EXCEPTION 'Office hierarchy cycle is not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_office_hierarchy ON offices;
CREATE TRIGGER enforce_office_hierarchy
  BEFORE INSERT OR UPDATE OF organization_id, parent_office_id ON offices
  FOR EACH ROW EXECUTE FUNCTION enforce_office_hierarchy();
