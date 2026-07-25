-- Bootstrap seed: DSWD org, central office, role catalog

INSERT INTO organizations (code, name, status, policy_config)
VALUES ('DSWD', 'Department of Social Welfare and Development', 'active', '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO offices (organization_id, parent_office_id, name, level, status)
SELECT o.id, NULL, 'DSWD Central Office', 'central', 'active'
FROM organizations o
WHERE o.code = 'DSWD'
  AND NOT EXISTS (
    SELECT 1 FROM offices f
    WHERE f.organization_id = o.id AND f.level = 'central' AND f.parent_office_id IS NULL
  );

INSERT INTO roles (code) VALUES
  ('PLATFORM_ADMIN'),
  ('ORG_ADMIN'),
  ('OFFICE_ADMIN'),
  ('EVALUATOR'),
  ('APPROVER'),
  ('BENEFICIARY'),
  ('DEPENDENT')
ON CONFLICT (code) DO NOTHING;
