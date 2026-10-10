output "kubeconfig" {
  description = "Base64 kubeconfig for the LKE cluster (store as the KUBECONFIG_B64 CI secret)."
  value       = local.is_lke ? linode_lke_cluster.main[0].kubeconfig : null
  sensitive   = true
}

output "lke_cluster_id" {
  value = local.is_lke ? linode_lke_cluster.main[0].id : null
}

output "db_host" {
  value = linode_database_postgresql_v2.main.host_primary
}

output "db_port" {
  value = linode_database_postgresql_v2.main.port
}

output "db_root_username" {
  value     = linode_database_postgresql_v2.main.root_username
  sensitive = true
}

output "db_root_password" {
  value     = linode_database_postgresql_v2.main.root_password
  sensitive = true
}

output "db_ca_cert" {
  description = "PEM CA for sslmode=verify-full (→ PG_CA_CERT secret)."
  value       = linode_database_postgresql_v2.main.ca_cert
  sensitive   = true
}

output "vault_bucket" {
  value = linode_object_storage_bucket.vault.label
}

output "s3_endpoint" {
  value = "https://${var.obj_region}.linodeobjects.com"
}

output "s3_public_base_url" {
  description = "→ S3_PUBLIC_BASE_URL / NEXT_PUBLIC_S3_PUBLIC_BASE_URL. TODO(🔎 VERIFY) virtual-host URL format."
  value       = "https://${linode_object_storage_bucket.vault.label}.${var.obj_region}.linodeobjects.com"
}

output "s3_app_access_key" {
  value     = linode_object_storage_key.app.access_key
  sensitive = true
}

output "s3_app_secret_key" {
  value     = linode_object_storage_key.app.secret_key
  sensitive = true
}

output "api_host_ipv4" {
  description = "vm mode: public IPv4 of the API host (SSH + api A record / sslip.io hostname)."
  value       = local.is_vm ? local.vm_public_ipv4 : null
}

output "api_hostname" {
  description = "Hostname Caddy serves the API on."
  value       = local.has_domain ? "${var.api_record_name}.${var.domain}" : (local.is_vm ? "api.${replace(local.vm_public_ipv4, ".", "-")}.sslip.io" : null)
}
