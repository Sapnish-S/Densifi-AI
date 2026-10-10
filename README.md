# Densify

Clinical-grade hair-restoration tracking: lighting-gated scalp photos in a monthly vault, AI
comparison of density and miniaturization, daily treatment check-ins, lab-report extraction, and a
Pro tier with clinical analytics and a (mock) specialist network.

Densify runs on **Akamai Cloud**, with the web app on Vercel.

## Architecture

| Part | Runs on | Code |
|---|---|---|
| Web app (Next.js 16.2.6, React 19, Better Auth) | **Vercel** (Git import of this repo, root `frontend/`) | `frontend/` |
| API "Densify Core Engine" (FastAPI) | **Akamai Linode VM** — Docker Compose + Caddy (auto-HTTPS) behind a Cloud Firewall | `backend/`, `deploy/vm/` |
| Database | **Akamai Managed PostgreSQL 16** | `db/schema/0001_init.sql` |
| Vault photos | **Akamai Object Storage** (S3-compatible, public-read objects) | `frontend/lib/s3.ts` |
| Network, DNS | **Akamai VPC, Cloud Firewall, DNS Manager** | `infra/terraform/` |
| AI | **AWS Bedrock** (Claude Sonnet 4.5 vision/OCR, Nova Lite formatter/chat) via `backend/llm_provider.py`; Anthropic API adapter also available | `backend/analyzer.py` |
| Email | Brevo | `backend/email_service.py` |

A Kubernetes path is kept for scale-up: `deployment_mode = "lke"` in Terraform plus the Helm chart in
`deploy/helm/densify/` (LKE, optional Akamai App Platform).

```
frontend/   Next.js app
backend/    FastAPI service, pytest suite (tests/), Dockerfile
db/         SQL schema files + apply-schema.sh (+ Dockerfile for the k8s schema Job)
e2e/        Playwright end-to-end suite (runs in the official Playwright container)
infra/      Terraform (linode/linode): VPC, Linode VM or LKE, Managed PostgreSQL, Object Storage, firewall, DNS
deploy/     provision.sh, vm/ (API host), vercel/ (env generator), helm/ (LKE path), local/ (dev S3 config)
```

## Local development

Requirements: Docker Desktop (nothing else — Node, Python, Terraform and Playwright all run in containers).

```bash
cp .env.example .env            # optional: real keys; defaults work offline
docker compose up --build       # postgres:16, S3 (SeaweedFS), schema, api, web
```

- Web: http://localhost:3000 · API: http://localhost:8000 (docs at `/docs`) · S3: http://localhost:9000
- Locally the AI runs on a deterministic **mock provider** (`LLM_PROVIDER=mock`); set `LLM_PROVIDER=bedrock`
  and AWS keys (or `anthropic` + `ANTHROPIC_API_KEY`) in `.env` for real analysis.
- Without `BREVO_API_KEY`, OTP emails are logged and skipped; read codes from the
  `verification` table.

### Tests

```bash
docker compose --profile test run --rm api-test                         # backend: pytest (77 tests)
docker compose --profile e2e run --rm --no-deps e2e --project=desktop    # Playwright E2E (91 tests)
```

The backend suite uses a throwaway `densify_test` database and mocks the LLM/S3. The E2E suite covers every
screen against the running stack.

## Deploying (hackathon setup)

First-time Akamai setup and the credentials to collect are in the team's **Akamai Cloud Setup Guide**.
Credentials live only in the gitignored `secrets/` folder (`linode_token.txt`, `obj_access_key.txt`,
`obj_secret_key.txt`, `aws_access_key_id.txt`, `aws_secret_access_key.txt`, optional `brevo_api_key.txt`).

```bash
deploy/provision.sh bootstrap          # once: Terraform state bucket
DOMAIN=densify.tech deploy/provision.sh plan          # review resources + cost
DOMAIN=densify.tech deploy/provision.sh apply --yes   # VM, firewall, DB, bucket, DNS (billable)

VERCEL_ORIGINS=https://densify-ai.vercel.app deploy/vm/deploy.sh   # API: upload, apply schema, start, smoke test

deploy/vercel/render-env.sh            # writes secrets/vercel.env
```

Then in Vercel: import this repo, set **Root Directory = `frontend`**, paste `secrets/vercel.env` into
Environment Variables, deploy. With a custom domain, add `app.<domain>` in Vercel → Domains (Terraform
already points the CNAME at Vercel) and re-run `render-env.sh` / `deploy.sh` with the new origins.

Tear down: `deploy/provision.sh destroy --yes`.

Alternative without Git import: `deploy/vercel/deploy.sh` deploys with the Vercel CLI (needs
`secrets/vercel_token.txt`).

## Known gaps

- Logo artwork: `frontend/public/densify-logo-{dark,light,login}.svg` and other binary assets (hero,
  mascots, avatars, favicons) still need to be added to `frontend/public/`.
- Items marked `🔎 VERIFY` in Terraform (plan ids, region availability, DB defaults) are confirmed at the
  first `terraform plan`.
