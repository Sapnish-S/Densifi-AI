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

## Site assets (images live in Object Storage, not in git)

Logos, icons, hero photos, mascots and other site imagery are **not committed**. They are
stored in the vault bucket under the public `site/` prefix — Akamai Object Storage in
staging/prod, SeaweedFS locally — and the app links to them with `siteAsset("brand/logo-white.png")`
(`frontend/lib/site-assets.ts`). The base URL is `${NEXT_PUBLIC_S3_PUBLIC_BASE_URL}/site`
(override with `NEXT_PUBLIC_SITE_ASSETS_URL`), so no extra configuration is needed per environment.
`frontend/public/` only keeps `sw.js`.

Working copy: `frontend/site-assets/` (gitignored), mirroring the bucket layout:

```
site-assets/
  brand/    logo-black.png, logo-white.png, mark-black.png, mark-white.png
  icons/    favicons (icon-light/dark-32x32), icon-192/512, apple-icon
  hero/     hero-man.jpg, hero-man-bald.jpg, hero-growmap.png   (landing regrowth effect)
  mascots/  dr-claude.png, dr-nova.png
  avatars/  avatar-1..3.png                                    (testimonial photos, optional)
  app/      hero-model.png                                      (optional)
  source/   original logo renders the brand assets are generated from
```

Sync with `npm run assets:upload` / `npm run assets:download` (from `frontend/`). They use the
same `S3_*` variables as the app (or `S3_AKAMAI_*` with `--target akamai`; the npm scripts load
the repo-root `.env`), upload only changed files (MD5 vs ETag) and set `Content-Type` and
`Cache-Control`.

```sh
cd frontend
# Akamai — S3_AKAMAI_* from the repo-root .env
npm run assets:download -- --target akamai          # get the current set
npm run assets:upload   -- --target akamai --dry-run
npm run assets:upload   -- --target akamai

# Local stack (SeaweedFS from docker compose)
S3_ENDPOINT=http://127.0.0.1:9000 S3_BUCKET=densify-vault-storage \
S3_ACCESS_KEY_ID=densify-local S3_SECRET_ACCESS_KEY=densify-local-secret \
npm run assets:upload
```

Public read on Akamai comes from the bucket policy (`site/*` next to `vault/*`, see Terraform);
the bucket rejects per-object ACLs. Akamai's `us-ord-10` endpoint also doesn't support bucket CORS
configuration, so images WebGL must read (the hero regrowth plates) fall back to the same-origin
`/site-proxy/*` rewrite in `frontend/next.config.mjs`; everything else loads straight from the
bucket. Generators for derived assets: `frontend/scripts/brand/` (logos/icons from
`source/1.png`) and `frontend/scripts/hero-regrowth/` (bald plate + growth map).

## Known gaps

- Testimonial avatars (`site/avatars/avatar-1..3.png`) are not uploaded yet; cards fall back to initials.
- **Fresh local stacks and CI start with an empty SeaweedFS**, so site images 404 until someone runs
  `npm run assets:download -- --target akamai` + the local `assets:upload` above. Tests don't assert on
  images and the hero falls back to the static photo, so CI still passes.
- **Akamai bucket state (prod, `densify-vault-storage`)** — set up by hand on 2026-10-10, ahead of
  `terraform apply`: all `site/*` assets uploaded, and `site/*` added to the `PublicReadVaultObjects`
  policy statement (the per-key `auto-*` statement was kept). `infra/terraform/main.tf` already
  declares the same policy, so the next apply is a no-op for it. The staging bucket has no site assets yet.
- **No bucket CORS on Akamai `us-ord-10`** — `PutBucketCors`/`GetBucketCors` return `501 NotImplemented`
  and objects come back without `Access-Control-Allow-Origin`, so `aws_s3_bucket_cors_configuration.vault`
  will fail on apply. Site images are unaffected (plain `<img>`; the WebGL hero uses `/site-proxy`),
  but **vault uploads are at risk in prod**: the browser PUTs to a presigned URL
  (`components/vault-panel.tsx`), which needs CORS. Options: an upload proxy route in the app, or a
  bucket on an endpoint that supports CORS. Verify with a real upload before launch.
- **Admin Object Storage keys** live in `secrets/obj_access_key.txt` (20-char key id) and
  `secrets/obj_secret_key.txt` (secret); Terraform uses them for the bucket policy/CORS. They were
  stored swapped/invalid before 2026-10-10 and have been replaced.
- **E2E flake under `next dev`** — `02-landing › engine room … terminal typewriter` can time out when the
  suite runs against a dev server (slow dev bundles + software-rendered WebGL hero starve the
  typewriter interval). It passes against the production build (`docker compose up web`), which is
  what CI uses.
- Items marked `🔎 VERIFY` in Terraform (plan ids, region availability, DB defaults) are confirmed at the
  first `terraform plan`.
