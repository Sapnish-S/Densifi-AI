#!/usr/bin/env bash
# Shared helpers for the deploy scripts. Credentials come only from ../secrets/*.txt
# (gitignored); nothing is printed or committed.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRETS="$ROOT/secrets"
ENV_NAME="${ENV_NAME:-prod}"
TF_IMAGE="hashicorp/terraform:1.9"
export MSYS_NO_PATHCONV=1

secret() {  # secret <name> [optional]
  local f="$SECRETS/$1.txt"
  if [ -s "$f" ]; then tr -d '\r\n' < "$f"; return; fi
  [ "${2:-}" = "optional" ] && return 0
  echo "missing secrets/$1.txt (see the Akamai Cloud Setup Guide)" >&2; exit 1
}

winpath() { if command -v cygpath >/dev/null; then cygpath -w "$1"; else echo "$1"; fi; }

ssh_key() {  # generates a dedicated deploy key on first use
  local k="$SECRETS/densify_deploy"
  [ -f "$k" ] || ssh-keygen -q -t ed25519 -N "" -C "densify-deploy" -f "$k"
  echo "$k"
}

admin_cidr() { echo "$(curl -fsS https://api.ipify.org)/32"; }

# tf <dir> <terraform args...> — runs Terraform in a container with backend + provider creds.
tf() {
  local dir="$1"; shift
  docker run --rm -i \
    -v "$(winpath "$ROOT/infra/terraform")":/tf -w "/tf/$dir" \
    -e AWS_ACCESS_KEY_ID="$(secret obj_access_key)" \
    -e AWS_SECRET_ACCESS_KEY="$(secret obj_secret_key)" \
    -e TF_VAR_linode_token="$(secret linode_token)" \
    -e TF_VAR_obj_admin_access_key="$(secret obj_access_key)" \
    -e TF_VAR_obj_admin_secret_key="$(secret obj_secret_key)" \
    -e TF_VAR_ssh_public_key="$(cat "$(ssh_key).pub")" \
    -e TF_VAR_admin_cidrs="[\"${ADMIN_CIDR:-$(admin_cidr)}\"]" \
    -e TF_VAR_domain="${DOMAIN:-}" \
    -e TF_VAR_app_origins="${APP_ORIGINS_JSON:-[\"https://densify-ai.vercel.app\"]}" \
    "$TF_IMAGE" "$@"
}

tf_out() { tf . output -raw "$1" 2>/dev/null; }
