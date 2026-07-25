-- Demo staff accounts for Nest web auth (AUTH_PROVIDER_MODE=mock).
-- Passwords (bcrypt): see comments next to each email.

DO $$
DECLARE
  org_id UUID;
  office_id UUID;
  platform_role UUID;
  org_role UUID;
  office_role UUID;
  eval_role UUID;
  appr_role UUID;
  uid UUID;
BEGIN
  SELECT id INTO org_id FROM organizations WHERE code = 'DSWD' LIMIT 1;
  SELECT id INTO office_id FROM offices
    WHERE organization_id = org_id AND level = 'central'
    ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO platform_role FROM roles WHERE code = 'PLATFORM_ADMIN';
  SELECT id INTO org_role FROM roles WHERE code = 'ORG_ADMIN';
  SELECT id INTO office_role FROM roles WHERE code = 'OFFICE_ADMIN';
  SELECT id INTO eval_role FROM roles WHERE code = 'EVALUATOR';
  SELECT id INTO appr_role FROM roles WHERE code = 'APPROVER';

  -- platform@ehelp.local / PlatformAdmin123!
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE email = 'platform@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, office_id, 'platform_admin', 'platform@ehelp.local',
      '$2b$10$8jMHpuqTRv9buyrzmB0T2e1slHS/cBsNtCY8edGEEYethAkSWOOI2',
      'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name) VALUES (uid, 'Platform Admin');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id) VALUES (uid, platform_role, office_id);
  END IF;

  -- orgadmin@ehelp.local / OrgAdmin123!
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE email = 'orgadmin@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, office_id, 'staff', 'orgadmin@ehelp.local',
      '$2b$10$WnXiFXtJbS6xCFujM.74iew0B3lLrL2ERePpoIvUmW0gwbTkQ2WCa',
      'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name) VALUES (uid, 'Organization Admin');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id) VALUES (uid, org_role, office_id);
  END IF;

  -- officeadmin@ehelp.local / OfficeAdmin123!
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE email = 'officeadmin@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, office_id, 'staff', 'officeadmin@ehelp.local',
      '$2b$10$bKXkAzcJRVnxbwO2NTlg6O19PWW6XVhLFlSmTQg8T7vBdOinpKk4i',
      'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name) VALUES (uid, 'Office Admin');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id) VALUES (uid, office_role, office_id);
  END IF;

  -- evaluator@ehelp.local / Evaluator123!
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE email = 'evaluator@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, office_id, 'staff', 'evaluator@ehelp.local',
      '$2b$10$Dd1rDwIdcT7K22.7yqwD4uyNryr.he7BOnT9/9YyNTEgxDnp7lT2G',
      'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name) VALUES (uid, 'Demo Evaluator');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id) VALUES (uid, eval_role, office_id);
  END IF;

  -- approver@ehelp.local / Approver123!
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE email = 'approver@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, office_id, 'staff', 'approver@ehelp.local',
      '$2b$10$oWP5XbrvhZcRTghfCqo6.eSTK51urHHK8Oo2N2Swm0myf73Y7/VG.',
      'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name) VALUES (uid, 'Demo Approver');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id) VALUES (uid, appr_role, office_id);
  END IF;
END $$;
