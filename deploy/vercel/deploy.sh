#!/usr/bin/env bash
# Deploy the Next.js frontend to Vercel with the Vercel CLI (no Git integration).
#   deploy/vercel/deploy.sh
# Needs secrets/vercel_token.txt and the Terraform outputs from deploy/provision.sh.
# Optional env: VERCEL_PROJECT=densify-ai  APP_URL=https://app.densify.tech  VERCEL_SCOPE=<team slug>
. "$(dirname "$0")/../lib.sh"

VERCEL_CLI="vercel@60.1.1"
PROJECT="${VERCEL_PROJECT:-densify-ai}"
APP_URL="${APP_URL:-https://$PROJECT.vercel.app}"
API_HOSTNAME="$(tf_out api_hostname)"
[ -n "$API_HOSTNAME" ] || { echo "no api_hostname output — provision + deploy the API first" >&2; exit 1; }

# Stable secrets generated once and kept in secrets/ (needed again for every redeploy and the cutover).
[ -s "$SECRETS/better_auth_secret.txt" ] || openssl rand -base64 48 | tr -d '\n' > "$SECRETS/better_auth_secret.txt"
[ -s "$SECRETS/server_actions_key.txt" ] || openssl rand -base64 32 | tr -d '\n' > "$SECRETS/server_actions_key.txt"

CA="$(tf_out db_ca_cert)"
printf '%s' "$CA" | grep -q "BEGIN CERTIFICATE" || CA="$(printf '%s' "$CA" | base64 -d)"
DB_PASS_ENC="$(py -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$(tf_out db_root_password)")"
DATABASE_URL="postgresql://$(tf_out db_root_username):$DB_PASS_ENC@$(tf_out db_host):$(tf_out db_port)/${DB_NAME:-defaultdb}?sslmode=verify-full"
S3_PUBLIC="$(tf_out s3_public_base_url)"

vercel() {
  docker run --rm -i -v "$(winpath "$ROOT/frontend")":/app -w /app \
    -e VERCEL_TOKEN="$(secret vercel_token)" node:22-alpine \
    npx -y "$VERCEL_CLI" --token "$(secret vercel_token)" ${VERCEL_SCOPE:+--scope "$VERCEL_SCOPE"} "$@"
}

setenv() {  # setenv NAME VALUE  (production environment; overwrites)
  vercel env rm "$1" production --yes >/dev/null 2>&1 || true
  printf '%s' "$2" | vercel env add "$1" production >/dev/null
  echo "  set $1"
}

echo "== linking Vercel project $PROJECT"
vercel link --yes --project "$PROJECT" >/dev/null

echo "== environment"
setenv DATABASE_URL "$DATABASE_URL"
setenv PG_CA_CERT "$CA"
setenv BETTER_AUTH_SECRET "$(secret better_auth_secret)"
setenv BETTER_AUTH_URL "$APP_URL"
setenv TRUSTED_ORIGINS "$APP_URL,https://$PROJECT.vercel.app"
setenv NEXT_SERVER_ACTIONS_ENCRYPTION_KEY "$(secret server_actions_key)"
setenv NEXT_PUBLIC_APP_URL "$APP_URL"
setenv NEXT_PUBLIC_API_URL "https://$API_HOSTNAME"
setenv S3_ENDPOINT "$(tf_out s3_endpoint)"
setenv S3_REGION "us-ord"
setenv S3_BUCKET "$(tf_out vault_bucket)"
setenv S3_ACCESS_KEY_ID "$(tf_out s3_app_access_key)"
setenv S3_SECRET_ACCESS_KEY "$(tf_out s3_app_secret_key)"
setenv S3_FORCE_PATH_STYLE "true"
setenv S3_PUBLIC_BASE_URL "$S3_PUBLIC"
setenv NEXT_PUBLIC_S3_PUBLIC_BASE_URL "$S3_PUBLIC"
setenv TZ_HEADER_NAME "x-vercel-ip-timezone"
setenv NEXT_PUBLIC_VAPID_PUBLIC_KEY "${NEXT_PUBLIC_VAPID_PUBLIC_KEY:-BGjBpdwMv6EVVogFahtW6HBfXyrAMNw8yrz5G0ZQzwInjmawwZA0HPovl0Tus1AoJUvEUAReEe0aTES6ql3r27E}"
INTERNAL="$(secret internal_api_secret optional)"; [ -z "$INTERNAL" ] || setenv INTERNAL_API_SECRET "$INTERNAL"

echo "== production deploy (remote build on Vercel)"
vercel deploy --prod --yes

echo "== smoke test"
curl -fsS -o /dev/null -w "landing %{http_code}\n" "$APP_URL/landing"
curl -fsS "$APP_URL/api/healthz"; echo
