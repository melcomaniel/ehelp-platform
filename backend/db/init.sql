-- Deprecated standalone bootstrap.
-- Schema is applied by backend/db/init.sh (migrations + seed) on first Docker boot.
-- See backend/README.md — wipe the volume to re-apply: docker compose down -v && docker compose up -d
SELECT 1;
