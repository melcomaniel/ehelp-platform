-- Regional Admin can request Officer (Evaluator/Approver) accounts for their
-- own office; the request enters the standard admin-approval flow before the
-- account can log in. Track "requested" and "approved" as distinct audit
-- actions so the trail shows both steps separately.
-- Idempotent for the same reason as migration 017: earlier databases may
-- still carry an older version of this constraint.

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
      'office_created', 'office_updated', 'office_parent_changed',
      'office_archived', 'office_reactivated', 'office_admin_created',
      'staff_account_requested', 'staff_account_approved'
    ));
