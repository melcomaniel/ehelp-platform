-- Hackathon eGov SSO sample identities → Nest staff (live SSO testing).
-- Mint exchange codes with partner {{partner_code}} for these exact emails.
--
-- | Email                    | Role            | Office              |
-- | ssoplatform@ehelp.local        | PLATFORM_ADMIN  | (none)              |
-- | ssoorgadmin@ehelp.local      | ORG_ADMIN       | DSWD Central Office |
-- | ssoofficeadmin@ehelp.local      | OFFICE_ADMIN    | NCR Field Office    |
-- | ssoevaluator@ehelp.local      | EVALUATOR       | NCR Field Office    |
-- | ssoapprover@ehelp.local      | APPROVER        | NCR Field Office    |
--
-- Mobile beneficiary: use a non-staff eGov identity (or mock SSO). These five
-- are web-only after this seed (mobile will get web_required).
-- Re-running re-aligns office designations for existing ssoplatform* rows.

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

  -- ssoorgadmin@ehelp.local — Org Admin (org-scoped, no office)
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE lower(email) = 'ssoorgadmin@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, NULL, 'staff', 'ssoorgadmin@ehelp.local', NULL, 'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name)
    VALUES (uid, 'ORGADMIN SSO DEMO');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id)
    VALUES (uid, org_role, NULL);
  ELSE
    UPDATE user_accounts
      SET organization_id = org_id, office_id = NULL, is_active = true, status = 'active'
      WHERE lower(email) = 'ssoorgadmin@ehelp.local';
    UPDATE user_role_assignments ura
      SET office_id = NULL, role_id = org_role
      FROM user_accounts ua
      WHERE ura.user_account_id = ua.id AND lower(ua.email) = 'ssoorgadmin@ehelp.local';
  END IF;

  -- ssoofficeadmin@ehelp.local — Office Admin @ NCR Field
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE lower(email) = 'ssoofficeadmin@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, regional_id, 'staff', 'ssoofficeadmin@ehelp.local', NULL, 'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name)
    VALUES (uid, 'OFFICEADMIN SSO DEMO');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id)
    VALUES (uid, office_role, regional_id);
  ELSE
    UPDATE user_accounts
      SET organization_id = org_id, office_id = regional_id, is_active = true, status = 'active'
      WHERE lower(email) = 'ssoofficeadmin@ehelp.local';
    UPDATE user_role_assignments ura
      SET office_id = regional_id, role_id = office_role
      FROM user_accounts ua
      WHERE ura.user_account_id = ua.id AND lower(ua.email) = 'ssoofficeadmin@ehelp.local';
  END IF;

  -- ssoevaluator@ehelp.local — Evaluator @ NCR Field
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE lower(email) = 'ssoevaluator@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, regional_id, 'staff', 'ssoevaluator@ehelp.local', NULL, 'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name)
    VALUES (uid, 'EVALUATOR SSO DEMO');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id)
    VALUES (uid, eval_role, regional_id);
  ELSE
    UPDATE user_accounts
      SET organization_id = org_id, office_id = regional_id, is_active = true, status = 'active'
      WHERE lower(email) = 'ssoevaluator@ehelp.local';
    UPDATE user_role_assignments ura
      SET office_id = regional_id, role_id = eval_role
      FROM user_accounts ua
      WHERE ura.user_account_id = ua.id AND lower(ua.email) = 'ssoevaluator@ehelp.local';
  END IF;

  -- ssoapprover@ehelp.local — Approver @ NCR Field
  IF NOT EXISTS (SELECT 1 FROM user_accounts WHERE lower(email) = 'ssoapprover@ehelp.local') THEN
    INSERT INTO user_accounts (organization_id, office_id, account_type, email, password_hash, status, is_active, verified_at)
    VALUES (org_id, regional_id, 'staff', 'ssoapprover@ehelp.local', NULL, 'active', true, now())
    RETURNING id INTO uid;
    INSERT INTO staff_profiles (user_account_id, full_name)
    VALUES (uid, 'APPROVER SSO DEMO');
    INSERT INTO user_role_assignments (user_account_id, role_id, office_id)
    VALUES (uid, appr_role, regional_id);
  ELSE
    UPDATE user_accounts
      SET organization_id = org_id, office_id = regional_id, is_active = true, status = 'active'
      WHERE lower(email) = 'ssoapprover@ehelp.local';
    UPDATE user_role_assignments ura
      SET office_id = regional_id, role_id = appr_role
      FROM user_accounts ua
      WHERE ura.user_account_id = ua.id AND lower(ua.email) = 'ssoapprover@ehelp.local';
  END IF;
END $$;
