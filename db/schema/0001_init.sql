-- 0001_init — Densify schema (PostgreSQL 16).
-- Identifiers are exact: quoted camelCase columns ("userId", "createdAt", ...) and
-- the snake_case tables notification_prefs / retention_check_in. No FOREIGN KEYs
-- by design. TIMESTAMPTZ throughout.

-- ===== Better Auth (identifiers must match Better Auth 1.6 defaults) =====
CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  image TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  scope TEXT,
  password TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ
);

-- ===== App tables =====
CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free',
  "displayName" TEXT,
  avatar TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS progress_photo (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "dataUrl" TEXT NOT NULL,
  angle TEXT NOT NULL DEFAULT 'crown',
  "takenAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_message (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  "photoId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agent_daily_count (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS medication (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  name TEXT NOT NULL,
  dose TEXT NOT NULL,
  frequency TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lab_report (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  label TEXT NOT NULL,
  "dataUrl" TEXT NOT NULL,
  "reportDate" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  dht NUMERIC,
  "freeT" NUMERIC,
  ferritin NUMERIC
);
CREATE TABLE IF NOT EXISTS daily_checkin (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  date TEXT NOT NULL,
  treatment_taken BOOLEAN NOT NULL,
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("userId", date)
);
-- Notification preferences:
CREATE TABLE IF NOT EXISTS notification_prefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  push_endpoint TEXT,
  push_p256dh TEXT,
  push_auth TEXT,
  daily_medication BOOLEAN NOT NULL DEFAULT true,
  daily_photo BOOLEAN NOT NULL DEFAULT true,
  pro_upsell BOOLEAN NOT NULL DEFAULT true,
  inactivity_retention BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  has_completed_onboarding BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS retention_check_in (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  medication_adherent BOOLEAN,
  restart_date TEXT,
  planned_start_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_session_user ON session("userId");
CREATE INDEX IF NOT EXISTS idx_account_user ON account("userId");
CREATE INDEX IF NOT EXISTS idx_profile_user ON profile("userId");
CREATE INDEX IF NOT EXISTS idx_photo_user ON progress_photo("userId");
CREATE INDEX IF NOT EXISTS idx_agent_msg_user ON agent_message("userId");
CREATE INDEX IF NOT EXISTS idx_agent_count_user ON agent_daily_count("userId");
CREATE INDEX IF NOT EXISTS idx_medication_user ON medication("userId");
CREATE INDEX IF NOT EXISTS idx_lab_report_user ON lab_report("userId");
CREATE INDEX IF NOT EXISTS idx_daily_checkin_user_date ON daily_checkin("userId", date);
