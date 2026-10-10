#!/usr/bin/env bash
# Deploy the FastAPI backend to the Akamai Linode VM created by Terraform (vm mode).
#   deploy/vm/deploy.sh
# Steps: read Terraform outputs → render .env + DB CA into a staging dir → copy to the
# VM over SSH → wait for cloud-init → run migrations → (re)build + start api and Caddy
# → smoke test https://<api hostname>/health.
# Optional env: VERCEL_ORIGINS="https://densify-ai.vercel.app,https://app.densify.tech"
. "$(dirname "$0")/../lib.sh"

KEY="$(ssh_key)"
HOST_IP="$(tf_out api_host_ipv4)"
API_HOSTNAME="$(tf_out api_hostname)"
[ -n "$HOST_IP" ] || { echo "no api_host_ipv4 output — run deploy/provision.sh apply --yes first" >&2; exit 1; }
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$SECRETS/known_hosts" "root@$HOST_IP")

STAGE="$(mktemp -d)"; trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/backend" "$STAGE/db"
cp "$ROOT"/backend/{main,database,analyzer,email_service,llm_provider}.py "$ROOT"/backend/{requirements.txt,Dockerfile,.dockerignore} "$STAGE/backend/"
cp -r "$ROOT/db/migrations" "$ROOT/db/migrate.sh" "$STAGE/db/"
cp "$ROOT/deploy/vm/docker-compose.yml" "$ROOT/deploy/vm/Caddyfile" "$STAGE/"

# Managed PostgreSQL CA (the provider returns it base64-encoded; accept raw PEM too).
CA="$(tf_out db_ca_cert)"
if printf '%s' "$CA" | grep -q "BEGIN CERTIFICATE"; then printf '%s\n' "$CA" > "$STAGE/pg-ca.crt"
else printf '%s' "$CA" | base64 -d > "$STAGE/pg-ca.crt"; fi

DB_USER="$(tf_out db_root_username)"; DB_PASS="$(tf_out db_root_password)"
DB_HOST="$(tf_out db_host)"; DB_PORT="$(tf_out db_port)"
DB_NAME="${DB_NAME:-defaultdb}"  # TODO(🔎 VERIFY): default database name on Akamai Managed PostgreSQL
ENC_PASS="$(py -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$DB_PASS")"

umask 077
cat > "$STAGE/.env" <<ENV
API_HOSTNAME=$API_HOSTNAME
DATABASE_URL=postgresql://$DB_USER:$ENC_PASS@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=verify-full
S3_ENDPOINT=$(tf_out s3_endpoint)
S3_REGION=us-ord-1
S3_BUCKET=$(tf_out vault_bucket)
S3_ACCESS_KEY_ID=$(tf_out s3_app_access_key)
S3_SECRET_ACCESS_KEY=$(tf_out s3_app_secret_key)
S3_FORCE_PATH_STYLE=true
LLM_PROVIDER=bedrock
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=$(secret aws_access_key_id)
AWS_SECRET_ACCESS_KEY=$(secret aws_secret_access_key)
LLM_VISION_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0
LLM_FAST_MODEL=us.amazon.nova-lite-v1:0
CORS_ALLOW_ORIGINS=${VERCEL_ORIGINS:-https://densify-ai.vercel.app}
INTERNAL_API_SECRET=$(secret internal_api_secret optional)
BREVO_API_KEY=$(secret brevo_api_key optional)
EMAIL_SENDER_ADDRESS=densly.official@gmail.com
EMAIL_SENDER_NAME=Densify Clinical
ENV

echo "== waiting for cloud-init on $HOST_IP"
"${SSH[@]}" "cloud-init status --wait >/dev/null; test -f /var/lib/cloud/densify-ready"

echo "== uploading release"
tar -C "$STAGE" -czf - . | "${SSH[@]}" "mkdir -p /opt/densify && tar -xzf - -C /opt/densify && chmod 600 /opt/densify/.env"

echo "== migrations + start"
"${SSH[@]}" "cd /opt/densify && docker compose --profile migrate run --rm migrate && docker compose up -d --build --remove-orphans && docker image prune -f >/dev/null"

echo "== smoke test https://$API_HOSTNAME/health"
for i in $(seq 1 30); do
  if curl -fsS "https://$API_HOSTNAME/health"; then echo; echo "API live at https://$API_HOSTNAME"; exit 0; fi
  sleep 5
done
echo "API did not become healthy; check: ssh -i secrets/densify_deploy root@$HOST_IP 'cd /opt/densify && docker compose logs --tail 100'" >&2
exit 1
