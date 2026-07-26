-- Platform Administrator organization/tenant management.
-- Rollback (after rolling back application code and exporting new history):
--   DROP TRIGGER IF EXISTS enforce_admin_role_scope ON user_role_assignments;
--   DROP FUNCTION IF EXISTS enforce_admin_role_scope();
--   DROP TRIGGER IF EXISTS enforce_admin_account_scope ON user_accounts;
--   DROP FUNCTION IF EXISTS enforce_admin_account_scope();
--   DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs;
--   DROP FUNCTION IF EXISTS reject_audit_log_mutation();
--   DROP TABLE IF EXISTS organization_invitations;
--   DROP INDEX IF EXISTS organizations_code_normalized_uidx;
--   DROP INDEX IF EXISTS organizations_creation_key_uidx;
--   ALTER TABLE audit_logs DROP COLUMN IF EXISTS outcome,
--     DROP COLUMN IF EXISTS reason, DROP COLUMN IF EXISTS request_id;
--   ALTER TABLE organizations DROP COLUMN IF EXISTS suspended_at,
--     DROP COLUMN IF EXISTS archived_at, DROP COLUMN IF EXISTS lifecycle_reason,
--     DROP COLUMN IF EXISTS creation_key;
-- The previous organization/audit CHECK constraints must then be restored from
-- migrations 002 and 007 if an old application build is redeployed.

DO $$
BEGIN
  IF EXISTS (
    SELECT upper(code)
    FROM organizations
    GROUP BY upper(code)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot normalize organization codes: case-insensitive duplicates exist';
  END IF;
END $$;

UPDATE organizations SET code = upper(trim(code));

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_status_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_status_check
    CHECK (status IN ('active', 'suspended', 'archived')),
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifecycle_reason TEXT,
  ADD COLUMN IF NOT EXISTS creation_key UUID;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_code_normalized_uidx
  ON organizations (upper(code));

CREATE UNIQUE INDEX IF NOT EXISTS organizations_creation_key_uidx
  ON organizations (creation_key)
  WHERE creation_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_account_id UUID NOT NULL REFERENCES user_accounts(id),
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_user_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_invitations_org_idx
  ON organization_invitations (organization_id);
CREATE INDEX IF NOT EXISTS organization_invitations_user_idx
  ON organization_invitations (user_account_id);
CREATE UNIQUE INDEX IF NOT EXISTS organization_invitations_active_uidx
  ON organization_invitations (organization_id, user_account_id)
  WHERE status = 'pending';

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
      'role_assigned', 'invitation_created', 'invitation_accepted'
    )),
  ADD COLUMN IF NOT EXISTS outcome TEXT NOT NULL DEFAULT 'success'
    CHECK (outcome IN ('success', 'failure')),
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT;

CREATE OR REPLACE FUNCTION reject_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs are append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs;
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION reject_audit_log_mutation();

-- Correct the legacy demo seed to the platform-scope invariant.
UPDATE user_accounts u
SET organization_id = NULL, office_id = NULL, updated_at = now()
FROM user_role_assignments ura
JOIN roles r ON r.id = ura.role_id
WHERE ura.user_account_id = u.id
  AND r.code = 'PLATFORM_ADMIN';

UPDATE user_accounts u
SET office_id = NULL, updated_at = now()
FROM user_role_assignments ura
JOIN roles r ON r.id = ura.role_id
WHERE ura.user_account_id = u.id
  AND r.code = 'ORG_ADMIN';

UPDATE user_role_assignments ura
SET office_id = NULL
FROM roles r
WHERE r.id = ura.role_id
  AND r.code IN ('PLATFORM_ADMIN', 'ORG_ADMIN');

CREATE OR REPLACE FUNCTION enforce_admin_role_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  role_code TEXT;
  account_org UUID;
  account_office UUID;
  account_kind TEXT;
BEGIN
  SELECT code INTO role_code FROM roles WHERE id = NEW.role_id;
  SELECT organization_id, office_id, account_type
    INTO account_org, account_office, account_kind
    FROM user_accounts WHERE id = NEW.user_account_id;

  IF role_code = 'PLATFORM_ADMIN' AND
     (account_org IS NOT NULL OR account_office IS NOT NULL OR
      NEW.office_id IS NOT NULL OR account_kind <> 'platform_admin') THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN must be an unscoped platform_admin account';
  END IF;

  IF role_code = 'ORG_ADMIN' AND
     (account_org IS NULL OR account_office IS NOT NULL OR
      NEW.office_id IS NOT NULL OR account_kind <> 'staff') THEN
    RAISE EXCEPTION 'ORG_ADMIN must be tenant-scoped staff with no office';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_admin_role_scope ON user_role_assignments;
CREATE CONSTRAINT TRIGGER enforce_admin_role_scope
  AFTER INSERT OR UPDATE ON user_role_assignments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_admin_role_scope();

CREATE OR REPLACE FUNCTION enforce_admin_account_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  has_platform_role BOOLEAN;
  has_org_role BOOLEAN;
BEGIN
  SELECT
    bool_or(r.code = 'PLATFORM_ADMIN'),
    bool_or(r.code = 'ORG_ADMIN')
  INTO has_platform_role, has_org_role
  FROM user_role_assignments ura
  JOIN roles r ON r.id = ura.role_id
  WHERE ura.user_account_id = NEW.id;

  IF COALESCE(has_platform_role, false) AND
     (NEW.organization_id IS NOT NULL OR NEW.office_id IS NOT NULL OR
      NEW.account_type <> 'platform_admin') THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN must be an unscoped platform_admin account';
  END IF;

  IF COALESCE(has_org_role, false) AND
     (NEW.organization_id IS NULL OR NEW.office_id IS NOT NULL OR
      NEW.account_type <> 'staff') THEN
    RAISE EXCEPTION 'ORG_ADMIN must be tenant-scoped staff with no office';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_admin_account_scope ON user_accounts;
CREATE CONSTRAINT TRIGGER enforce_admin_account_scope
  AFTER INSERT OR UPDATE ON user_accounts
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_admin_account_scope();
