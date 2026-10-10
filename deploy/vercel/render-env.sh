#!/usr/bin/env bash
# Write secrets/vercel.env — paste its contents into Vercel → Project → Settings →
# Environment Variables (Production) before the first deploy. Values come from the
# Terraform outputs and secrets/*.txt; the file stays in the gitignored secrets/ folder.
#   deploy/vercel/render-env.sh                      # app at https://densify-ai.vercel.app
#   APP_URL=https://app.densify.tech EXTRA_ORIGINS=https://densify-ai.vercel.app deploy/vercel/render-env.sh
. "$(dirname "$0")/../lib.sh"

APP_URL="${APP_URL:-https://densify-ai.vercel.app}"
API_HOSTNAME="$(tf_out api_hostname)"
[ -n "$API_HOSTNAME" ] || { echo "no api_hostname output — run deploy/provision.sh apply --yes and deploy/vm/deploy.sh first" >&2; exit 1; }
[ -s "$SECRETS/better_auth_secret.txt" ] || openssl rand -base64 48 | tr -d '\n' > "$SECRETS/better_auth_secret.txt"
[ -s "$SECRETS/server_actions_key.txt" ] || openssl rand -base64 32 | tr -d '\n' > "$SECRETS/server_actions_key.txt"

CA="$(tf_out db_ca_cert)"   # one line of base64; lib/db.ts decodes it
printf '%s' "$CA" | grep -q "BEGIN CERTIFICATE" && CA="$(printf '%s' "$CA" | base64 | tr -d '\n')"
DB_PASS_ENC="$(py -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$(tf_out db_root_password)")"
S3_PUBLIC="$(tf_out s3_public_base_url)"
ORIGINS="$APP_URL${EXTRA_ORIGINS:+,$EXTRA_ORIGINS}"

umask 077
cat > "$SECRETS/vercel.env" <<ENV
DATABASE_URL=postgresql://$(tf_out db_root_username):$DB_PASS_ENC@$(tf_out db_host):$(tf_out db_port)/${DB_NAME:-defaultdb}?sslmode=verify-full
PG_CA_CERT=$CA
BETTER_AUTH_SECRET=$(secret better_auth_secret)
BETTER_AUTH_URL=$APP_URL
TRUSTED_ORIGINS=$ORIGINS
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(secret server_actions_key)
NEXT_PUBLIC_APP_URL=$APP_URL
NEXT_PUBLIC_API_URL=https://$API_HOSTNAME
S3_ENDPOINT=$(tf_out s3_endpoint)
S3_REGION=us-ord
S3_BUCKET=$(tf_out vault_bucket)
S3_ACCESS_KEY_ID=$(tf_out s3_app_access_key)
S3_SECRET_ACCESS_KEY=$(tf_out s3_app_secret_key)
S3_FORCE_PATH_STYLE=true
S3_PUBLIC_BASE_URL=$S3_PUBLIC
NEXT_PUBLIC_S3_PUBLIC_BASE_URL=$S3_PUBLIC
TZ_HEADER_NAME=x-vercel-ip-timezone
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY:-BGjBpdwMv6EVVogFahtW6HBfXyrAMNw8yrz5G0ZQzwInjmawwZA0HPovl0Tus1AoJUvEUAReEe0aTES6ql3r27E}
INTERNAL_API_SECRET=$(secret internal_api_secret optional)
ENV
echo "wrote secrets/vercel.env ($(wc -l < "$SECRETS/vercel.env") variables) — paste it into Vercel, then redeploy."
echo "Also redeploy the API with VERCEL_ORIGINS=$ORIGINS so CORS allows the app."
