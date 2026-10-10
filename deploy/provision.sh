#!/usr/bin/env bash
# Provision Akamai Cloud infrastructure with Terraform.
#   deploy/provision.sh bootstrap        # once: state bucket (local state)
#   deploy/provision.sh plan             # shows every resource + change
#   deploy/provision.sh apply --yes      # creates/updates (billable!)
#   deploy/provision.sh destroy --yes    # removes everything Terraform created
# Optional env: DOMAIN=densify.tech  APP_ORIGINS_JSON='["https://app.densify.tech","https://densify-ai.vercel.app"]'
. "$(dirname "$0")/lib.sh"
action="${1:?bootstrap|plan|apply|destroy}"; confirm="${2:-}"
[ "$action" = plan ] || [ "$action" = bootstrap ] || [ "$confirm" = "--yes" ] || { echo "refusing to $action without --yes" >&2; exit 1; }

case "$action" in
  bootstrap)
    tf bootstrap init -input=false
    tf bootstrap apply -input=false -auto-approve ;;
  plan|apply|destroy)
    tf . init -input=false -reconfigure -backend-config="envs/$ENV_NAME.backend.hcl"
    case "$action" in
      plan)    tf . plan -input=false -var-file="envs/$ENV_NAME.tfvars" ;;
      apply)   tf . apply -input=false -auto-approve -var-file="envs/$ENV_NAME.tfvars" ;;
      destroy) tf . destroy -input=false -auto-approve -var-file="envs/$ENV_NAME.tfvars" ;;
    esac ;;
  *) echo "unknown action $action" >&2; exit 1 ;;
esac
