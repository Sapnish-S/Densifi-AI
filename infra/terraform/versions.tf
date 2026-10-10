terraform {
  required_version = ">= 1.6.0"

  required_providers {
    # TODO(🔎 VERIFY): confirm the latest 3.x release of linode/linode before first apply.
    linode = {
      source  = "linode/linode"
      version = "~> 3.0"
    }
    # Used only against the Akamai Object Storage S3 endpoint (bucket CORS + policy).
    # Never talks to AWS.
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.80"
    }
  }

  # Remote state in Akamai Object Storage (S3-compatible). Bucket/key/endpoint are
  # supplied per environment: terraform init -backend-config=envs/<env>.backend.hcl
  # Credentials: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY = an Object Storage key
  # with access to the state bucket (created once by bootstrap/).
  backend "s3" {
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}

provider "linode" {
  token = var.linode_token
}

provider "aws" {
  alias                       = "obj"
  region                      = var.obj_region
  access_key                  = var.obj_admin_access_key
  secret_key                  = var.obj_admin_secret_key
  skip_credentials_validation = true
  skip_region_validation      = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
  s3_use_path_style           = true

  endpoints {
    s3 = "https://${var.obj_region}.linodeobjects.com"
  }
}
