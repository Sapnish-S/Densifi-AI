-- 0004_doctor_portal — user roles, doctor profiles and doctor↔patient access links.
-- "user".role is set once at sign-up ("I'm a doctor" checkbox) and is not user-editable afterwards.
-- Role-specific data: patients → profile (0001), doctors → doctor_profile (below).
-- A doctor_patient link grants a doctor read access to a patient's data, per flag.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'patient'; -- 'patient' | 'doctor'

CREATE TABLE IF NOT EXISTS doctor_profile (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  specialty TEXT,
  "clinicName" TEXT,
  "licenseNumber" TEXT,
  bio TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctor_patient (
  id TEXT PRIMARY KEY,
  "doctorId" TEXT NOT NULL,  -- "user".id with role 'doctor'
  "patientId" TEXT NOT NULL, -- "user".id with role 'patient'
  status TEXT NOT NULL DEFAULT 'active', -- 'pending' | 'active' | 'concluded'
  "vaultAccessGranted" BOOLEAN NOT NULL DEFAULT false,
  "labAccessGranted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("doctorId", "patientId")
);

CREATE INDEX IF NOT EXISTS idx_user_role ON "user"(role);
CREATE INDEX IF NOT EXISTS idx_doctor_profile_user ON doctor_profile("userId");
CREATE INDEX IF NOT EXISTS idx_doc_patient_doc ON doctor_patient("doctorId");
CREATE INDEX IF NOT EXISTS idx_doc_patient_patient ON doctor_patient("patientId");
