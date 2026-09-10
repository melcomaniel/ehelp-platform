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
  "${DB_ROOT}/migrations/013_office_name_uniqueness.sql" \
  "${DB_ROOT}/migrations/014_organization_onboarding_policy.sql" \
  "${DB_ROOT}/migrations/015_additional_organization_admins.sql" \
  "${DB_ROOT}/migrations/016_office_admin_assignment.sql" \
  "${DB_ROOT}/migrations/017_allow_office_admin_audit_action.sql" \
  "${DB_ROOT}/migrations/018_office_staff_requests_audit_actions.sql" \
  "${DB_ROOT}/migrations/019_workflow_templates.sql" \
  "${DB_ROOT}/migrations/020_user_login_liveness.sql" \
  "${DB_ROOT}/migrations/021_profile_change_and_disbursement_slots.sql" \
  "${DB_ROOT}/migrations/022_program_periods_sites_vault.sql" \
  "${DB_ROOT}/migrations/023_disbursement_slot_program.sql" \
  "${DB_ROOT}/migrations/024_disbursement_claim_token.sql" \
  "${DB_ROOT}/migrations/025_disbursement_claim_liveness.sql" \
  "${DB_ROOT}/migrations/026_disbursement_claimed_status.sql" \
  "${DB_ROOT}/migrations/027_ereport_cases.sql"
do
  echo "[ehelp-db]   $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done

echo "[ehelp-db] Seeding..."
"${PSQL[@]}" -f "${DB_ROOT}/seed/001_bootstrap.sql"
"${PSQL[@]}" -f "${DB_ROOT}/seed/002_staff_accounts.sql"
"${PSQL[@]}" -f "${DB_ROOT}/seed/003_egov_sso_hackathon_accounts.sql"
echo "[ehelp-db] Done."
