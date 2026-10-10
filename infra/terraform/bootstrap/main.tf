# One-time bootstrap (local state, kept in this folder and gitignored): the Object
# Storage bucket that holds remote Terraform state. Run via `deploy/provision.sh bootstrap`.
# The Object Storage key the team creates in the Cloud Manager (setup guide, Step 2)
# is used for the state backend and for the vault bucket's CORS/policy.
terraform {
  required_providers {
    linode = { source = "linode/linode", version = "~> 3.0" } # TODO(🔎 VERIFY) latest
  }
}

variable "linode_token" {
  type      = string
  sensitive = true
}

variable "obj_region" {
  type    = string
  default = "us-ord-1"
}

provider "linode" {
  token = var.linode_token
}

resource "linode_object_storage_bucket" "tfstate" {
  region = var.obj_region
  label  = "densify-tfstate"

}
