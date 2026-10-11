# Task: Doctor portal — roles, contracted-doctor directory, patient sharing, messaging

You are working in the Densify repo (hair-restoration tracking). Read `README.md` first. Build the four
pieces below **in order** and stop at each checkpoint: run the tests and summarize what changed before
you start the next piece. Analytics, AI summaries, payments and WebSockets are **out of scope**.

## How the repo works (follow these conventions)

- **Web app on Vercel**: `frontend/`, Next.js 16 + React 19 + Better Auth (`frontend/lib/auth.ts`).
  Most app logic is in **server actions** (`frontend/app/actions/*.ts`). They query Postgres directly
  through `query()` / `withConnection()` from `frontend/lib/db.ts`, always with `$1` placeholders.
- **API on an Akamai Linode VM**: `backend/main.py`, FastAPI. It handles Bedrock AI and Brevo email.
  Vercel calls it with `getServerApiUrl()` + `internalApiHeaders()`, and the API checks those calls
  with `require_internal_secret`.
- **Database**: Akamai Managed Postgres 16. Schema files live in `db/schema/NNNN_name.sql` and are
  applied once each, in order, by `db/apply-schema.sh`. **Do not edit `0001_init.sql`. Add
  `0002_doctor_portal.sql`.** Match the existing style: `TEXT` ids (`randomUUID()` in the app), quoted
  camelCase columns (`"userId"`, `"createdAt"`), `TIMESTAMPTZ`, `CREATE TABLE IF NOT EXISTS`, an index
  on every lookup column, and **no foreign keys** (a deliberate project choice).
- **Photos**: Akamai Object Storage, S3-compatible (`frontend/lib/s3.ts`).
- **Local dev and tests run only in Docker**:
  - `docker compose up --build`
  - `docker compose --profile test run --rm api-test` (pytest)
  - `docker compose --profile e2e run --rm --no-deps e2e --project=desktop` (Playwright)
- The working tree has **uncommitted changes**: `vault-panel.tsx`, `06-vault.spec.ts`,
  `app/api/vault-put/`, Terraform, `deploy/vm/deploy.sh`. Build on top of them. Don't revert or
  overwrite them.
- Today the doctor network is a mock: `frontend/components/doctor-panel.tsx` has hardcoded
  `SPECIALISTS` and keeps chat only in React state, and `/api/appointments/*` in `backend/main.py`
  only sends email. You are replacing that mock. Keep the patient's `ProGate` on the doctor view
  as it is.

---

## Step 0 — Security groundwork (do this before anything else)

Once doctors can see patient data, photos must not be reachable through public URLs.

1. Make presigned GET the **only** way to read vault photos. Find every read path (`getS3Url` in
   `vault-panel.tsx`, `progression-vault.tsx`, `agent-view.tsx`, `vault-save/route.ts`, and the
   `VAULT_PRESIGNED_GET` branch in `telemetry.ts`). Change each one to return short-lived presigned
   URLs that are built on the server. Remove the feature flag.
2. Upload new objects as private. Find where uploads or Terraform set public-read and change that.
   Under "Ops follow-ups", list what is needed to make existing objects private (an ACL update
   script or command). Don't run it against real infrastructure.
3. Add `frontend/lib/access.ts` with:
   - `getSessionUser()`: returns `{ id, email, role }` or throws "Unauthorized".
   - `requireRole(role)`.
   - `assertCanView(viewerUserId, patientId, scope)`: passes if the viewer is the patient. Otherwise
     it requires an **active** `care_link` **and** the matching share flag on that link (see Step 3).
     Every allowed doctor read writes one row to `access_log`.
   Every doctor-side read of patient data must go through `assertCanView`. No exceptions.

**Checkpoint 0**: patient vault, overview and agent screens still show photos. Update the vault e2e
helpers if they depend on public URLs.

---

## Step 1 — Roles and doctor accounts (invite-only)

- Add `role` to the Better Auth user with `user.additionalFields`
  (`role: { type: "string", defaultValue: "patient", input: false }`), so it appears in the session and
  **sign-up cannot set it**. Add the column in `0002` (`"user".role TEXT NOT NULL DEFAULT 'patient'`).
  Values are `patient`, `doctor`, `admin`. Admins are set by hand with SQL.
- Public sign-up always creates a patient.
- **Doctors cannot sign themselves up as doctors.** An admin creates the `doctor_profile` row first
  (Step 2) with the doctor's email. When a user whose email is verified and matches an unclaimed
  `doctor_profile.email` (case-insensitive) signs in, link it: set `doctor_profile."userId"` and set
  `role = 'doctor'`. Do this in a Better Auth hook or a server-side check on first session, inside a
  transaction. The doctor goes through the existing OTP verification first.
- Routing (`frontend/middleware.ts` already calls `get-session`; read `role` from that response):
  - `doctor` → `/doctor/*`. Doctors don't get the patient dashboard.
  - `patient` → the existing `/` dashboard. `/doctor/*` and `/admin/*` redirect to `/`.
  - `admin` → `/admin/*`. Admins may also open `/`.
  Also check the role inside server actions and pages. Middleware alone is not enough.
- Add a doctor shell at `frontend/app/doctor/` (layout, sidebar: Patients, Requests, Messages,
  Profile). Reuse `components/ui/*` and the visual style of `dashboard-sidebar.tsx` /
  `dashboard-header.tsx`.

**Checkpoint 1**: a new sign-up is a patient. An invited email becomes a doctor and lands on
`/doctor`. Route guards hold in both directions.

---

## Step 2 — Directory of contracted doctors only

**Patients may only see doctors who are in our database and have an active contract with Densify.**
Nobody else ever appears.

Table `doctor_profile`:

| Column | Notes |
|---|---|
| `id` | TEXT PK |
| `"userId"` | TEXT NULL UNIQUE; null until the doctor claims the account |
| `email` | TEXT NOT NULL UNIQUE; the invite email |
| `"displayName"`, `specialty`, `"practiceName"`, `bio`, `"feeText"` | TEXT |
| `"avatarUrl"` | TEXT NULL |
| `"addressLine"`, `city`, `state`, `"postalCode"` | TEXT |
| `lat`, `lng` | DOUBLE PRECISION; entered by the admin, no geocoding service |
| `"contractStatus"` | `pending` \| `active` \| `paused` \| `ended`; default `pending` |
| `"contractStartedAt"`, `"contractEndsAt"` | TIMESTAMPTZ NULL |
| `listed` | BOOLEAN NOT NULL DEFAULT false |
| `"createdAt"`, `"updatedAt"` | TIMESTAMPTZ |

- **A doctor is visible only when** `"contractStatus" = 'active' AND listed = true AND
  ("contractEndsAt" IS NULL OR "contractEndsAt" > now())`. Put this rule in **one** SQL helper or
  view (for example `listed_doctor`), use it everywhere, and also apply it when a patient requests a
  connection, so nobody can connect by guessing an id. Never send `email` or the contract columns to
  patients.
- Patient directory (replaces `SPECIALISTS` in `doctor-panel.tsx`):
  - "Use my location" (browser geolocation; nothing is stored) sorts results by Haversine distance in
    SQL and offers radius filters (25 / 50 / 100 mi / any). Without location, filter by state/city
    text and sort by name.
  - Each card shows name, specialty, practice, city/state, distance (when known), fee, and a
    "Request to connect" button (Step 3).
- Admin page `/admin/doctors`: list, add and edit doctor profiles; change contract status;
  list/unlist. Keep it plain (a table and a form). Ending or pausing a contract hides the doctor at
  once but **keeps existing care links readable by the patient**. The doctor keeps only the access
  the patient still grants. Say in the summary which behavior you chose for messaging with a paused
  doctor.
- Local dev only: add `db/seed/dev_doctors.sql` with 3–4 clearly fake demo doctors (for example
  "Dr. Demo Alpha") and wire it into local compose. It must **not** be in `db/schema/`, and it must
  never run in staging or prod.

**Checkpoint 2**: only active, listed, in-contract doctors appear. Pausing one in the admin page
removes them from the directory, and connection requests to them fail.

---

## Step 3 — Patient–doctor links and patient-controlled sharing

Table `care_link`: `id`, `"patientId"`, `"doctorProfileId"`, `status` (`requested` | `active` |
`declined` | `ended`), `source` TEXT DEFAULT `'densify'`, `"requestedAt"`, `"respondedAt"`, `"endedAt"`,
`"endedBy"`, plus **share flags**, all BOOLEAN NOT NULL DEFAULT false: `"sharePhotos"`,
`"shareAnalyses"`, `"shareLabs"`, `"shareCheckins"`, `"shareRegimen"`, `"shareAiChat"`. Allow only one
open link (requested or active) per patient–doctor pair. Enforce this with a partial unique index.

Table `access_log`: `id`, `"viewerUserId"`, `"patientId"`, `scope`, `"resourceId"` NULL,
`"createdAt"`. Index on `("patientId", "createdAt")`.

Flow:
1. The patient taps "Request to connect" and picks which data to share in a consent dialog. Nothing
   is shared by default; the patient ticks each scope explicitly.
2. The doctor sees the request under **Requests** and accepts or declines it. Before acceptance the
   doctor sees only the patient's display name and that a request exists, with no data.
3. On the patient's side, add a "My doctors" section in the doctor view. For each linked doctor the
   patient can change share flags at any time, end the link (which clears every flag), and see
   **"Who viewed my data"**, read from `access_log`.
4. The doctor can end a link as well. Ended links are read-only history.

Doctor patient view `/doctor/patients/[patientId]`:
- Show only tabs whose share flag is on: Photos (vault timeline, side-by-side compare), Analyses (AI
  density reports), Labs, Check-ins / adherence, Regimen, AI chat transcript (`agent_message`,
  read-only).
- **Refactor, don't duplicate.** In `telemetry.ts`, `photos.ts`, `lab-reports.ts`, `medications.ts`
  and `agent.ts`, split each read into an internal `loadX(patientId)` and the existing patient action
  (`getUserId()` → `loadX(self)`). Add doctor actions in `frontend/app/actions/doctor.ts` that call
  `requireRole('doctor')` → `assertCanView(...)` → `loadX(patientId)`. Reuse the existing display
  components in a read-only mode (`readOnly` prop: hide upload, delete, edit and check-in controls).
- Doctors can never write patient data.

**Checkpoint 3**: share flags gate each tab and each server action independently. Test by calling the
action directly: turning off `sharePhotos` blocks the action itself, not just the tab. Ending a link
blocks everything. Every doctor read writes an `access_log` row.

---

## Step 4 — Messaging between patient and doctor

Tables:
- `conversation`: `id`, `"careLinkId"` UNIQUE, `"lastMessageAt"`.
- `message`: `id`, `"conversationId"`, `"senderUserId"`, `body` TEXT, `"attachmentType"` NULL
  (`analysis`), `"attachmentJson"` JSONB NULL, `"createdAt"`, `"readAt"` NULL. Index on
  `("conversationId", "createdAt")`.

Rules:
- Messaging works only on an **active** care link. Ended links stay readable but can't receive new
  messages.
- Patient side: replace the in-memory `chats` state in `doctor-panel.tsx` with these tables. The
  existing "forward my AI report" flow (`handleForwardReport` in `dashboard-client.tsx`) becomes a
  message with `attachmentType = 'analysis'` and a snapshot of the report. Sending a report is itself
  a deliberate share, so it does not depend on `"shareAnalyses"`.
- Doctor side: `/doctor/messages` lists conversations with unread counts and shows one thread at a time.
- Live updates use **polling** (Vercel functions can't hold sockets): an open thread checks every 5 s
  for messages after the last `createdAt`, and the unread badge checks every 30 s. Pause polling while
  the tab is hidden. Limit body length (for example 4,000 characters) and send rate (for example 30
  messages a minute per user) on the server.
- Email notification: add a FastAPI endpoint, protected by `require_internal_secret`, that sends a
  Brevo email through `email_service.py`. Send at most one email per conversation per recipient every
  15 minutes, and only when the recipient hasn't read the message. **The email must contain no
  medical details or message text**, only "You have a new message on Densify" and a link.
- Keep the appointment endpoints as they are. Saving appointments is out of scope.

**Checkpoint 4**: a patient and a doctor can exchange messages in two browsers, unread counts update,
and ending the link stops sending.

---

## Tests (keep the suites green)

- **Backend**: extend `backend/tests/test_00_schema.py` with the new tables, exact identifiers,
  indexes and unique constraints. Add a test for the notify endpoint covering auth, the rate limit,
  and the absence of message text in the email.
- **E2E**:
  - Rewrite `e2e/tests/07-doctors.spec.ts` for the real directory (it currently asserts the 3 mock
    specialists and the canned first message).
  - Add `09-doctor-portal.spec.ts`. It covers: invite claim → doctor routing; only contracted doctors
    listed; request → accept; share-flag gating, including a revoke mid-session; messaging both ways;
    ending a link.
  - Add helpers for creating an admin, a doctor profile and a doctor user.
- Run both suites with the Docker commands above and report the real results.

## Final summary

When you're done, report:
- the files changed;
- the new environment variables, if any, and whether `deploy/vercel/render-env.sh` needs them;
- the ops follow-ups (making existing objects private, applying schema `0002` to staging and prod,
  creating the first admin);
- the behavior choices you made where this spec left room;
- anything you couldn't verify.
