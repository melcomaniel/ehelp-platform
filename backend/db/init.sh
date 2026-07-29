#!/bin/bash
# First-boot orchestrator for Docker Postgres (/docker-entrypoint-initdb.d).
# Runs ordered migrations then seed. Only executes on empty data volume.
set -euo pipefail

# Compose mounts backend/db at /ehelp-db (see docker-compose.yml)
DB_ROOT="${EHELP_DB_ROOT:-/ehelp-db}"
export PGPASSWORD="${POSTGRES_PASSWORD:-ehelp}"
PSQL=(psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-ehelp}" --dbname "${POSTGRES_DB:-ehelp}")

echo "[ehelp-db] Running migrations from ${DB_ROOT}..."
for f in \
  "${DB_ROOT}/migrations/001_extensions.sql" \
  "${DB_ROOT}/migrations/002_tenancy_identity.sql" \
  "${DB_ROOT}/migrations/003_relationships.sql" \
  "${DB_ROOT}/migrations/004_programs_rules_workflow.sql" \
  "${DB_ROOT}/migrations/005_applications.sql" \
  "${DB_ROOT}/migrations/006_disbursement.sql" \
  "${DB_ROOT}/migrations/007_platform_services.sql" \
  "${DB_ROOT}/migrations/008_application_compat.sql" \
  "${DB_ROOT}/migrations/009_staff_profiles.sql" \
  "${DB_ROOT}/migrations/010_platform_admin_organization_management.sql" \
  "${DB_ROOT}/migrations/011_organization_admin_office_management.sql" \
  "${DB_ROOT}/migrations/012_backend_rbac_configuration.sql" \
  "${DB_ROOT}/migrations/013_office_name_uniqueness.sql"
do
  echo "[ehelp-db]   $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "[ehelp-db] Seeding..."
"${PSQL[@]}" -f "${DB_ROOT}/seed/001_bootstrap.sql"
"${PSQL[@]}" -f "${DB_ROOT}/seed/002_staff_accounts.sql"
echo "[ehelp-db] Done."
