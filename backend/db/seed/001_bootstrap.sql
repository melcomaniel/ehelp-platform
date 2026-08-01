-- Bootstrap seed: DSWD org, central + regional offices, role catalog
--
-- Hierarchy:
--   DSWD (organization)
--   └── DSWD Central Office (central)     ← Org Admin home
--       └── NCR Field Office (regional)   ← Office Admin / Evaluator / Approver
--
-- Hosted DBs may already have a regional office (e.g. DSWD NCR). This seed
-- creates missing rows only and always sets offices.code / normalized_code.

INSERT INTO organizations (code, name, status, policy_config)
VALUES ('DSWD', 'Department of Social Welfare and Development', 'active', '{}'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO offices (
  organization_id, parent_office_id, name, level, status, code, normalized_code
)
SELECT o.id, NULL, 'DSWD Central Office', 'central', 'active',
       'DSWD_CENTRAL', 'DSWD_CENTRAL'
FROM organizations o
WHERE o.code = 'DSWD'
  AND NOT EXISTS (
    SELECT 1 FROM offices f
    WHERE f.organization_id = o.id AND f.level = 'central' AND f.parent_office_id IS NULL
  );

-- Prefer a dedicated NCR Field Office under central. Skip if any regional already exists.
INSERT INTO offices (
  organization_id, parent_office_id, name, level, status, code, normalized_code
)
SELECT o.id, c.id, 'NCR Field Office', 'regional', 'active',
       'NCR_FIELD', 'NCR_FIELD'
FROM organizations o
JOIN offices c
  ON c.organization_id = o.id
 AND c.level = 'central'
 AND c.parent_office_id IS NULL
WHERE o.code = 'DSWD'
  AND NOT EXISTS (
    SELECT 1 FROM offices f
    WHERE f.organization_id = o.id AND f.level = 'regional'
  );

-- If a regional exists without a parent and central exists, attach it.
UPDATE offices r
SET parent_office_id = c.id,
    updated_at = now()
FROM organizations o
JOIN offices c
  ON c.organization_id = o.id
 AND c.level = 'central'
 AND c.parent_office_id IS NULL
WHERE o.code = 'DSWD'
  AND r.organization_id = o.id
  AND r.level = 'regional'
  AND r.parent_office_id IS NULL
  AND r.id <> c.id;

INSERT INTO roles (code) VALUES
  ('PLATFORM_ADMIN'),
  ('ORG_ADMIN'),
  ('OFFICE_ADMIN'),
  ('EVALUATOR'),
  ('APPROVER'),
  ('BENEFICIARY'),
  ('DEPENDENT')
ON CONFLICT (code) DO NOTHING;
