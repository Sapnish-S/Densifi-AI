#!/bin/sh
# Applies db/migrations/*.sql in lexical order, once each, recording them in
# schema_migrations. Requires psql and DATABASE_URL. Used by docker-compose and
# by the Helm pre-upgrade migration Job (image postgres:16).
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-$(dirname "$0")/migrations}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c \
  "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"

for f in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  version=$(basename "$f" .sql)
  applied=$(psql "$DATABASE_URL" -tA -c "SELECT 1 FROM schema_migrations WHERE version = '$version'")
  if [ "$applied" = "1" ]; then
    echo "SKIP  $version"
    continue
  fi
  echo "APPLY $version"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -1 -f "$f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "INSERT INTO schema_migrations (version) VALUES ('$version')"
done
echo "migrations complete"
