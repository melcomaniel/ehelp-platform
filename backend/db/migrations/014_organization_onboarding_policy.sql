-- Complete Platform Administrator onboarding policy and device activation gates.

DO $$
BEGIN
  IF EXISTS (
    SELECT user_account_id, device_fingerprint
    FROM device_registrations
    GROUP BY user_account_id, device_fingerprint
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce device uniqueness: duplicate registrations exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS device_registrations_user_fingerprint_uidx
  ON device_registrations (user_account_id, device_fingerprint);

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
      'device_registered',
      'office_created', 'office_updated', 'office_parent_changed', 'office_archived',
      'office_reactivated'
    ));
