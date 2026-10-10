#!/bin/sh
# Applies db/schema/*.sql in lexical order, once each, recording them in
# schema_versions. Requires psql and DATABASE_URL. Used by docker-compose and
# by the Helm pre-upgrade schema Job (image postgres:16).
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
SCHEMA_DIR="${SCHEMA_DIR:-$(dirname "$0")/schema}"

# One-time rename of the old tracking table so existing databases don't re-apply files.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c \
  "DO \$\$ BEGIN IF to_regclass('schema_migrations') IS NOT NULL AND to_regclass('schema_versions') IS NULL THEN ALTER TABLE schema_migrations RENAME TO schema_versions; END IF; END \$\$"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c \
  "CREATE TABLE IF NOT EXISTS schema_versions (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"

for f in $(ls "$SCHEMA_DIR"/*.sql | sort); do
  version=$(basename "$f" .sql)
  applied=$(psql "$DATABASE_URL" -tA -c "SELECT 1 FROM schema_versions WHERE version = '$version'")
  if [ "$applied" = "1" ]; then
    echo "SKIP  $version"
    continue
  fi
  echo "APPLY $version"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -1 -f "$f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "INSERT INTO schema_versions (version) VALUES ('$version')"
done
echo "schema up to date"
