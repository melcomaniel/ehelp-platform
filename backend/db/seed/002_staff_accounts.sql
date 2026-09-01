-- ============================================================================
-- ⚠️  LOCAL / DEMO ONLY — DO NOT RUN ON ANY SHARED, STAGING, OR PUBLIC DEPLOY.
--
-- This seed creates privileged accounts (including PLATFORM_ADMIN) whose
-- passwords are published in this file and in the READMEs. The bcrypt hashes
-- below are cost-10 over well-known strings, so deleting the comments would
-- NOT make them secret. Anyone who can reach a deployment where this seed has
-- run can log in as platform admin.
--
-- Before any non-local deployment, do one of:
--   * skip this seed entirely and provision staff via POST /auth/staff, or
--   * change every password_hash below to a value you generated privately.
-- ============================================================================
-- Demo staff accounts for Nest web auth (AUTH_PROVIDER_MODE=mock).
-- Passwords (bcrypt): see comments next to each email.
--
-- Designations (after 001_bootstrap hierarchy):
--   platform@ehelp.local     → PLATFORM_ADMIN (no org/office)
--   orgadmin@ehelp.local     → ORG_ADMIN      (org-scoped, no office)
--   officeadmin@ehelp.local  → OFFICE_ADMIN   @ regional (NCR Field / DSWD NCR)
--   evaluator@ehelp.local    → EVALUATOR      @ regional
--   approver@ehelp.local     → APPROVER       @ regional
--
-- Re-running this seed re-aligns office_id on account + role assignment.

DO $$
DECLARE
  org_id UUID;
  central_id UUID;
  regional_id UUID;
  platform_role UUID;
  org_role UUID;
  office_role UUID;
  eval_role UUID;
  appr_role UUID;
  uid UUID;
BEGIN
  SELECT id INTO org_id FROM organizations WHERE code = 'DSWD' LIMIT 1;
  SELECT id INTO central_id FROM offices
    WHERE organization_id = org_id AND level = 'central'
    ORDER BY created_at ASC LIMIT 1;
  -- Prefer named NCR Field Office; otherwise any regional under DSWD (hosted may use DSWD NCR).
  SELECT id INTO regional_id FROM offices
    WHERE organization_id = org_id AND level = 'regional' AND name = 'NCR Field Office'
    ORDER BY created_at ASC LIMIT 1;
  IF regional_id IS NULL THEN
    SELECT id INTO regional_id FROM offices
      WHERE organization_id = org_id AND level = 'regional'
      ORDER BY created_at ASC LIMIT 1;
  END IF;

  SELECT id INTO platform_role FROM roles WHERE code = 'PLATFORM_ADMIN';
  SELECT id INTO org_role FROM roles WHERE code = 'ORG_ADMIN';
  SELECT id INTO office_role FROM roles WHERE code = 'OFFICE_ADMIN';
  SELECT id INTO eval_role FROM roles WHERE code = 'EVALUATOR';
  SELECT id INTO appr_role FROM roles WHERE code = 'APPROVER';

  IF org_id IS NULL OR central_id IS NULL OR regional_id IS NULL THEN
    RAISE EXCEPTION 'DSWD org/offices missing — run 001_bootstrap.sql first';
  END IF;

  -- platform@ehelp.local / PlatformAdmin123!
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE email = 'platform@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (NULL, NULL, 'platform_admin', 'platform@ehelp.local',
      '$2b$10$8jMHpuqTRv9buyrzmB0T2e1slHS/cBsNtCY8edGEEYethAkSWOOI2',
      'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name) VALUES (uid, 'Platform Admin');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id) VALUES (uid, platform_role, NULL);
  END IF;

  -- orgadmin@ehelp.local / OrgAdmin123!  → org-scoped (no office)
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE email = 'orgadmin@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, NULL, 'staff', 'orgadmin@ehelp.local',
      '$2b$10$WnXiFXtJbS6xCFujM.74iew0B3lLrL2ERePpoIvUmW0gwbTkQ2WCa',
      'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name) VALUES (uid, 'Organization Admin');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id) VALUES (uid, org_role, NULL);
  ELSE
    UPDATE user_accounts
      SET organization_id = org_id, office_id = NULL, is_active = true, status = 'active'
      WHERE email = 'orgadmin@ehelp.local';
    UPDATE user_role_assignments ura
      SET office_id = NULL, role_id = org_role
      FROM user_accounts ua
      WHERE ura.user_account_id = ua.id AND ua.email = 'orgadmin@ehelp.local';
  END IF;

  -- officeadmin@ehelp.local / OfficeAdmin123!  → NCR Field
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE email = 'officeadmin@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, regional_id, 'staff', 'officeadmin@ehelp.local',
      '$2b$10$bKXkAzcJRVnxbwO2NTlg6O19PWW6XVhLFlSmTQg8T7vBdOinpKk4i',
      'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name) VALUES (uid, 'Office Admin');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id) VALUES (uid, office_role, regional_id);
  ELSE
    UPDATE user_accounts
      SET organization_id = org_id, office_id = regional_id, is_active = true, status = 'active'
      WHERE email = 'officeadmin@ehelp.local';
    UPDATE user_role_assignments ura
      SET office_id = regional_id, role_id = office_role
      FROM user_accounts ua
      WHERE ura.user_account_id = ua.id AND ua.email = 'officeadmin@ehelp.local';
  END IF;

  -- evaluator@ehelp.local / Evaluator123!  → NCR Field
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE email = 'evaluator@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, regional_id, 'staff', 'evaluator@ehelp.local',
      '$2b$10$Dd1rDwIdcT7K22.7yqwD4uyNryr.he7BOnT9/9YyNTEgxDnp7lT2G',
      'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name) VALUES (uid, 'Demo Evaluator');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id) VALUES (uid, eval_role, regional_id);
  ELSE
    UPDATE user_accounts
      SET organization_id = org_id, office_id = regional_id, is_active = true, status = 'active'
      WHERE email = 'evaluator@ehelp.local';
    UPDATE user_role_assignments ura
      SET office_id = regional_id, role_id = eval_role
      FROM user_accounts ua
      WHERE ura.user_account_id = ua.id AND ua.email = 'evaluator@ehelp.local';
  END IF;

  -- approver@ehelp.local / Approver123!  → NCR Field
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE email = 'approver@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, regional_id, 'staff', 'approver@ehelp.local',
      '$2b$10$oWP5XbrvhZcRTghfCqo6.eSTK51urHHK8Oo2N2Swm0myf73Y7/VG.',
      'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name) VALUES (uid, 'Demo Approver');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id) VALUES (uid, appr_role, regional_id);
  ELSE
    UPDATE user_accounts
      SET organization_id = org_id, office_id = regional_id, is_active = true, status = 'active'
      WHERE email = 'approver@ehelp.local';
    UPDATE user_role_assignments ura
      SET office_id = regional_id, role_id = appr_role
      FROM user_accounts ua
      WHERE ura.user_account_id = ua.id AND ua.email = 'approver@ehelp.local';
  END IF;
END $$;
