variable "env" {
  description = "Environment name: staging | prod"
  type        = string
  validation {
    condition     = contains(["staging", "prod"], var.env)
    error_message = "env must be staging or prod."
  }
}

variable "linode_token" {
  description = "Linode API personal access token (CI secret LINODE_TOKEN)."
  type        = string
  sensitive   = true
}

# TODO(🔎 VERIFY): confirm LKE, Managed PostgreSQL and Object Storage are all offered in us-ord.
variable "region" {
  description = "Akamai Cloud region for LKE, VPC and Managed DB."
  type        = string
  default     = "us-ord"
}

# Object Storage: region id (for buckets/keys) and S3 endpoint host are different — Chicago is
# region "us-ord" served from the E3 endpoint us-ord-10.linodeobjects.com (GET /v4/object-storage/endpoints).
variable "obj_region" {
  description = "Object Storage region id."
  type        = string
  default     = "us-ord"
}

variable "obj_endpoint" {
  description = "Object Storage S3 endpoint host for obj_region."
  type        = string
  default     = "us-ord-10.linodeobjects.com"
}

variable "obj_admin_access_key" {
  description = "Object Storage key used by Terraform for bucket CORS/policy (same key as the state backend)."
  type        = string
  sensitive   = true
}

variable "obj_admin_secret_key" {
  type      = string
  sensitive = true
}

# TODO(🔎 VERIFY): available LKE Kubernetes versions (`linode-cli lke versions-list`).
variable "k8s_version" {
  type    = string
  default = "1.33"
}

# TODO(🔎 VERIFY): plan id g6-dedicated-2 (Dedicated 4 GB, 2 vCPU).
variable "node_type" {
  type    = string
  default = "g6-dedicated-2"
}

variable "node_count" {
  type    = number
  default = 3
}

variable "node_autoscaler_min" {
  type    = number
  default = 3
}

variable "node_autoscaler_max" {
  type    = number
  default = 5
}

# TODO(🔎 VERIFY): Managed PostgreSQL engine ids (`linode-cli databases engines`), e.g. postgresql/16 or /17.
variable "db_engine_id" {
  type    = string
  default = "postgresql/16"
}

# TODO(🔎 VERIFY): DB plan ids (prod Dedicated 4 GB, staging shared 2 GB).
variable "db_type" {
  type    = string
  default = "g6-dedicated-2"
}

variable "db_cluster_size" {
  type    = number
  default = 3
}

variable "db_extra_allow_list" {
  description = "Extra CIDRs allowed to reach the DB (e.g. a bastion). LKE node IPs are added automatically."
  type        = list(string)
  default     = []
}

variable "vpc_subnet_cidr" {
  type    = string
  default = "10.0.0.0/20"
}

variable "vault_bucket_label" {
  type    = string
  default = "densify-vault-storage"
}

variable "vault_public_read" {
  description = "Public-read vault objects. Set false only when VAULT_PRESIGNED_GET is enabled in the app."
  type        = bool
  default     = true
}

variable "app_origins" {
  description = "Web app origins. Unused while the vault bucket is on an E3 endpoint (no CORS support)."
  type        = list(string)
}

variable "domain" {
  description = "Apex domain managed in Linode DNS Manager (e.g. a GitHub Student Pack .tech). Empty = no DNS records (Vercel URL + sslip.io for the API)."
  type        = string
  default     = ""
}

variable "manage_domain" {
  description = "Create the linode_domain zone in this stack (true for prod; staging reuses it)."
  type        = bool
  default     = false
}

variable "soa_email" {
  type    = string
  default = ""
}

variable "app_record_name" {
  description = "DNS label for the web app (app | app-staging)."
  type        = string
}

variable "api_record_name" {
  description = "DNS label for the API (api | api-staging)."
  type        = string
}

variable "ingress_ipv4" {
  description = "lke mode only: NodeBalancer IPv4 created by ingress-nginx (known after the first helm install). Empty = skip the api A record."
  type        = string
  default     = ""
}

variable "tags" {
  type    = list(string)
  default = ["densify"]
}

variable "app_platform_enabled" {
  description = "Install Akamai App Platform on LKE (registry, ingress, TLS, observability)."
  type        = bool
  default     = true
}

variable "deployment_mode" {
  description = "Where the FastAPI backend runs: vm (one Linode, default) | lke (Kubernetes + Helm)."
  type        = string
  default     = "vm"
  validation {
    condition     = contains(["vm", "lke"], var.deployment_mode)
    error_message = "deployment_mode must be vm or lke."
  }
}

# TODO(🔎 VERIFY): plan id for Linode 4 GB shared (g6-standard-2).
variable "vm_type" {
  description = "vm mode: Linode plan for the API host."
  type        = string
  default     = "g6-standard-2"
}

variable "ssh_public_key" {
  description = "vm mode: SSH public key allowed to log in as root (secrets/densify_deploy.pub)."
  type        = string
  default     = ""
}

variable "admin_cidrs" {
  description = "vm mode: CIDRs allowed to SSH to the API host (your current public IP/32)."
  type        = list(string)
  default     = []
}

variable "vercel_cname_target" {
  description = "CNAME target for the app hostname (Vercel custom domain)."
  type        = string
  default     = "cname.vercel-dns.com"
}
