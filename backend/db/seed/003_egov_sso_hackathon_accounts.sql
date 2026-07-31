-- Hackathon eGov SSO sample identities → Nest staff (live SSO testing).
-- Mint exchange codes with partner {{partner_code}} for these exact emails.
--
-- | Email                    | Role            |
-- | ssoplatform@ehelp.local        | PLATFORM_ADMIN  |
-- | ssoorgadmin@ehelp.local      | ORG_ADMIN       |
-- | ssoofficeadmin@ehelp.local      | OFFICE_ADMIN    |
-- | ssoevaluator@ehelp.local      | EVALUATOR       |
-- | ssoapprover@ehelp.local      | APPROVER        |
--
-- Mobile beneficiary: use a non-staff eGov identity (or mock SSO). These five
-- are web-only after this seed (mobile will get web_required).

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

  IF org_id IS NULL OR office_id IS NULL THEN
    RAISE EXCEPTION 'DSWD org/office missing — run 001_bootstrap.sql first';
  END IF;

  -- ssoplatform@ehelp.local — Platform Admin
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE lower(email) = 'ssoplatform@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (NULL, NULL, 'platform_admin', 'ssoplatform@ehelp.local', NULL, 'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name)
    VALUES (uid, 'PLATFORM SSO DEMO');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id)
    VALUES (uid, platform_role, NULL);
  END IF;

  -- ssoorgadmin@ehelp.local — Org Admin
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE lower(email) = 'ssoorgadmin@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, office_id, 'staff', 'ssoorgadmin@ehelp.local', NULL, 'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name)
    VALUES (uid, 'ORGADMIN SSO DEMO');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id)
    VALUES (uid, org_role, office_id);
  END IF;

  -- ssoofficeadmin@ehelp.local — Office Admin
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE lower(email) = 'ssoofficeadmin@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, office_id, 'staff', 'ssoofficeadmin@ehelp.local', NULL, 'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name)
    VALUES (uid, 'OFFICEADMIN SSO DEMO');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id)
    VALUES (uid, office_role, office_id);
  END IF;

  -- ssoevaluator@ehelp.local — Evaluator
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE lower(email) = 'ssoevaluator@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, office_id, 'staff', 'ssoevaluator@ehelp.local', NULL, 'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name)
    VALUES (uid, 'EVALUATOR SSO DEMO');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id)
    VALUES (uid, eval_role, office_id);
  END IF;

  -- ssoapprover@ehelp.local — Approver
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE lower(email) = 'ssoapprover@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, office_id, 'staff', 'ssoapprover@ehelp.local', NULL, 'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name)
    VALUES (uid, 'APPROVER SSO DEMO');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id)
    VALUES (uid, appr_role, office_id);
  END IF;
END $$;
