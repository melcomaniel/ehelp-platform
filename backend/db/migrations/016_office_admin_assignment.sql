-- Support Organization Admins assigning a Regional Admin (Office Administrator)
-- to a specific Regional Office.

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
      'organization_admin_reactivated',
      'role_assigned', 'invitation_created', 'invitation_accepted',
      'device_registered',
      'office_created', 'office_updated', 'office_parent_changed', 'office_archived',
      'office_reactivated', 'office_admin_created'
    ));
