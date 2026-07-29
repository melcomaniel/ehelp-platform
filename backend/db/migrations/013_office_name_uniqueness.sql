-- Office names are tenant-scoped for Organization Administrator office creation.
-- Rollback:
--   DROP INDEX IF EXISTS offices_org_name_ci_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS offices_org_name_ci_uidx
  ON offices (organization_id, lower(trim(name)));
