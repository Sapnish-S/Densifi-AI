locals {
  name   = "densify-${var.env}"
  tags   = concat(var.tags, [var.env])
  is_vm  = var.deployment_mode == "vm"
  is_lke = var.deployment_mode == "lke"
}

# Topology (team decision 2026-10-10):
#   web  → Vercel (Next.js, deployed with the Vercel CLI)
#   api  → Akamai: one Linode VM (deployment_mode = "vm", default) or LKE ("lke")
#   data → Akamai Managed PostgreSQL + Object Storage; DNS in Linode DNS Manager
#   AI   → AWS Bedrock (LLM_PROVIDER=bedrock)

# ── Network ──────────────────────────────────────────────────────────────────

resource "linode_vpc" "main" {
  label       = local.name
  region      = var.region
  description = "Densify ${var.env} private network"
}

resource "linode_vpc_subnet" "app" {
  vpc_id = linode_vpc.main.id
  label  = "app"
  ipv4   = var.vpc_subnet_cidr
}

# ── API host: single Linode VM (default) ─────────────────────────────────────
# Docker + Compose are installed by cloud-init; deploy/vm/deploy.sh copies the
# backend and runs it behind Caddy (automatic HTTPS for the api hostname).

resource "linode_instance" "api" {
  count           = local.is_vm ? 1 : 0
  label           = "${local.name}-api"
  region          = var.region
  type            = var.vm_type
  image           = "linode/ubuntu24.04"
  authorized_keys = [trimspace(var.ssh_public_key)]
  tags            = local.tags

  metadata {
    user_data = base64encode(file("${path.module}/cloud-init.yaml"))
  }

  interface {
    purpose = "public"
  }

  interface {
    purpose   = "vpc"
    subnet_id = linode_vpc_subnet.app.id
  }
}

resource "linode_firewall" "api" {
  count           = local.is_vm ? 1 : 0
  label           = "${local.name}-api"
  tags            = local.tags
  inbound_policy  = "DROP"
  outbound_policy = "ACCEPT"

  inbound {
    label    = "https"
    action   = "ACCEPT"
    protocol = "TCP"
    ports    = "80,443"
    ipv4     = ["0.0.0.0/0"]
    ipv6     = ["::/0"]
  }

  inbound {
    label    = "ssh-admin"
    action   = "ACCEPT"
    protocol = "TCP"
    ports    = "22"
    ipv4     = var.admin_cidrs
  }

  linodes = [linode_instance.api[0].id]
}

# ── API host: LKE cluster (scale-up path) ────────────────────────────────────
# TODO(🔎 VERIFY): standard LKE provisions its own VPC; attaching this VPC/subnet to
# node pools may require LKE Enterprise.

resource "linode_lke_cluster" "main" {
  count       = local.is_lke ? 1 : 0
  label       = local.name
  region      = var.region
  k8s_version = var.k8s_version
  tags        = local.tags

  # Akamai App Platform: Harbor, ingress-nginx, cert-manager, Prometheus/Grafana/Loki, Argo CD.
  # TODO(🔎 VERIFY): App Platform minimum node size/count in us-ord.
  apl_enabled = var.app_platform_enabled

  control_plane {
    high_availability = var.env == "prod" || var.app_platform_enabled
  }

  pool {
    type  = var.node_type
    count = var.node_count

    autoscaler {
      min = var.node_autoscaler_min
      max = var.node_autoscaler_max
    }
  }

  lifecycle {
    ignore_changes = [pool[0].count]
  }
}

locals {
  lke_node_ids = local.is_lke ? flatten([for p in linode_lke_cluster.main[0].pool : [for n in p.nodes : n.instance_id]]) : []
}

data "linode_instances" "lke_nodes" {
  count = local.is_lke ? 1 : 0
  filter {
    name   = "id"
    values = local.lke_node_ids
  }
}

# TODO(🔎 VERIFY): NodeBalancer (192.168.255.0/24) and LKE control-plane (192.168.128.0/17)
# source ranges for us-ord; autoscaled nodes join `linodes` on the next apply.
resource "linode_firewall" "lke" {
  count           = local.is_lke ? 1 : 0
  label           = "${local.name}-lke"
  tags            = local.tags
  inbound_policy  = "DROP"
  outbound_policy = "ACCEPT"

  inbound {
    label    = "nodebalancer-tcp"
    action   = "ACCEPT"
    protocol = "TCP"
    ports    = "80,443,30000-32767"
    ipv4     = ["192.168.255.0/24"]
  }

  inbound {
    label    = "nodebalancer-udp"
    action   = "ACCEPT"
    protocol = "UDP"
    ports    = "30000-32767"
    ipv4     = ["192.168.255.0/24"]
  }

  inbound {
    label    = "lke-kubelet"
    action   = "ACCEPT"
    protocol = "TCP"
    ports    = "10250"
    ipv4     = ["192.168.128.0/17"]
  }

  inbound {
    label    = "lke-wireguard"
    action   = "ACCEPT"
    protocol = "UDP"
    ports    = "51820"
    ipv4     = ["192.168.128.0/17"]
  }

  inbound {
    label    = "lke-calico-ipencap"
    action   = "ACCEPT"
    protocol = "IPENCAP"
    ipv4     = ["192.168.128.0/17"]
  }

  linodes = local.lke_node_ids
}

# ── Managed PostgreSQL ───────────────────────────────────────────────────────
# vm mode: Next.js runs on Vercel, whose functions have no fixed egress IPs, so the
# database accepts connections from anywhere — TLS (verify-full) + a long generated
# password are the controls. lke mode: only the cluster nodes.
# TODO(🔎 VERIFY): Managed DB VPC attachment would let the VM connect privately.

resource "linode_database_postgresql_v2" "main" {
  label        = local.name
  engine_id    = var.db_engine_id
  region       = var.region
  type         = var.db_type
  cluster_size = var.db_cluster_size

  allow_list = concat(
    local.is_vm ? ["0.0.0.0/0"] : [for i in data.linode_instances.lke_nodes[0].instances : "${i.ip_address}/32"],
    var.db_extra_allow_list,
  )
}

# ── Object Storage (vault images) ────────────────────────────────────────────

resource "linode_object_storage_bucket" "vault" {
  region = var.obj_region
  label  = var.env == "prod" ? var.vault_bucket_label : "${var.vault_bucket_label}-${var.env}"
  # No CORS: the E3 endpoint (us-ord-10) supports it neither via the Linode API
  # (cors_enabled) nor via S3 PutBucketCors (501). Browsers therefore never PUT here
  # directly — the web app uploads server-side through /api/vault-put.
}

resource "linode_object_storage_key" "app" {
  label = "${local.name}-app"

  bucket_access {
    bucket_name = linode_object_storage_bucket.vault.label
    region      = var.obj_region
    permissions = "read_write"
  }
}

# Browser PUTs to presigned URLs from the app origin(s) — the Vercel URL(s) in vm mode.
resource "aws_s3_bucket_cors_configuration" "vault" {
  provider = aws.obj
  bucket   = linode_object_storage_bucket.vault.label

  cors_rule {
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = var.app_origins
    allowed_headers = ["Content-Type", "content-type"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Vault objects and site imagery (site/*, uploaded with `npm run assets:upload`)
# are publicly readable so <img src> works directly.
resource "aws_s3_bucket_policy" "vault_public_read" {
  count    = var.vault_public_read ? 1 : 0
  provider = aws.obj
  bucket   = linode_object_storage_bucket.vault.label

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadVaultObjects"
      Effect    = "Allow"
      Principal = { AWS = ["*"] }
      Action    = ["s3:GetObject"]
      Resource = [
        "arn:aws:s3:::${linode_object_storage_bucket.vault.label}/vault/*",
        "arn:aws:s3:::${linode_object_storage_bucket.vault.label}/site/*",
      ]
    }]
  })
}

# ── DNS (Linode DNS Manager) — only when a domain is configured ──────────────

resource "linode_domain" "root" {
  count     = var.domain != "" && var.manage_domain ? 1 : 0
  domain    = var.domain
  type      = "master"
  soa_email = var.soa_email
  tags      = var.tags
}

data "linode_domain" "root" {
  count  = var.domain != "" && !var.manage_domain ? 1 : 0
  domain = var.domain
}

locals {
  has_domain = var.domain != ""
  domain_id  = !local.has_domain ? null : (var.manage_domain ? linode_domain.root[0].id : data.linode_domain.root[0].id)
  # Public IPv4 of the VM (skip Linode private 192.168/16 and VPC 10/8; public ranges include 172.x).
  vm_public_ipv4 = local.is_vm ? one([for ip in linode_instance.api[0].ipv4 : ip if !startswith(ip, "10.") && !startswith(ip, "192.168.")]) : ""
  api_ipv4       = local.is_vm ? local.vm_public_ipv4 : var.ingress_ipv4
}

# app.<domain> → Vercel (add the same hostname as a custom domain in the Vercel project).
resource "linode_domain_record" "app" {
  count       = local.has_domain ? 1 : 0
  domain_id   = local.domain_id
  record_type = "CNAME"
  name        = var.app_record_name
  target      = var.vercel_cname_target
  ttl_sec     = 300
}

# api.<domain> → the VM (or the LKE ingress NodeBalancer IP).
resource "linode_domain_record" "api" {
  # count must be known at plan time: the VM's IP is not, but a VM always has one.
  count       = local.has_domain && (local.is_vm || var.ingress_ipv4 != "") ? 1 : 0
  domain_id   = local.domain_id
  record_type = "A"
  name        = var.api_record_name
  target      = local.api_ipv4
  ttl_sec     = 300
}
