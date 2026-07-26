-- Backend-owned RBAC configuration for web admin.
-- Rollback:
--   DROP TABLE IF EXISTS office_rbac_grants;
--   DROP TABLE IF EXISTS rbac_global_grants;

CREATE TABLE IF NOT EXISTS rbac_global_grants (
  role TEXT NOT NULL
    CHECK (role IN ('satellite_admin', 'approver', 'evaluator')),
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);

CREATE TABLE IF NOT EXISTS office_rbac_grants (
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  role TEXT NOT NULL
    CHECK (role IN ('satellite_admin', 'approver', 'evaluator')),
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (office_id, role, permission)
);

CREATE INDEX IF NOT EXISTS office_rbac_grants_office_idx
  ON office_rbac_grants (office_id);

INSERT INTO rbac_global_grants (role, permission) VALUES
  ('satellite_admin', 'view_analytics'),
  ('satellite_admin', 'customize_templates'),
  ('satellite_admin', 'manage_region_rbac'),
  ('satellite_admin', 'register_accounts'),
  ('satellite_admin', 'approve_accounts'),
  ('satellite_admin', 'evaluate_applications'),
  ('satellite_admin', 'approve_applications'),
  ('satellite_admin', 'submit_recommendations'),
  ('satellite_admin', 'act_recommendations'),
  ('satellite_admin', 'register_customers'),
  ('evaluator', 'evaluate_applications'),
  ('evaluator', 'register_customers'),
  ('evaluator', 'submit_recommendations'),
  ('approver', 'approve_applications'),
  ('approver', 'release_disbursements'),
  ('approver', 'act_recommendations')
ON CONFLICT DO NOTHING;

INSERT INTO office_rbac_grants (office_id, role, permission)
SELECT o.id, g.role, g.permission
FROM offices o
CROSS JOIN rbac_global_grants g
WHERE o.status = 'active'
ON CONFLICT DO NOTHING;
