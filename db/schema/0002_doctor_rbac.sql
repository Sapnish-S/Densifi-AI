-- 0002_doctor_rbac — Role-Based Access Control and Clinician Portal schema.
-- Extends user with role, adds clinician profiles, doctor-patient relationships,
-- clinical consultation messaging with attachment cards, SOAP chart notes, and regimen proposals.

-- 1. Extend user table with role
ALTER TABLE "user" 
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'patient';

-- 2. Doctor credentials & profile
CREATE TABLE IF NOT EXISTS doctor_profile (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  "licenseNumber" TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT 'Trichology & Hair Restoration',
  "clinicName" TEXT,
  bio TEXT,
  "consultFee" NUMERIC DEFAULT 150.00,
  verified BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Doctor-Patient Relationship & Access Permissions
CREATE TABLE IF NOT EXISTS doctor_patient (
  id TEXT PRIMARY KEY,
  "doctorId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "patientId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- 'pending', 'active', 'concluded'
  "vaultAccessGranted" BOOLEAN NOT NULL DEFAULT true,
  "labAccessGranted" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("doctorId", "patientId")
);

-- 4. Consultation Messages (Chat with embedded Report Attachments)
CREATE TABLE IF NOT EXISTS consultation_message (
  id TEXT PRIMARY KEY,
  "relationshipId" TEXT NOT NULL REFERENCES doctor_patient(id) ON DELETE CASCADE,
  "senderId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "senderRole" TEXT NOT NULL, -- 'patient' | 'doctor' | 'system'
  content TEXT NOT NULL,
  "attachmentType" TEXT, -- 'vault_report', 'lab_report', 'regimen_proposal'
  "attachmentId" TEXT,
  "attachmentPayload" JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Doctor SOAP Clinical Notes (Strictly visible only to clinicians)
CREATE TABLE IF NOT EXISTS clinical_note (
  id TEXT PRIMARY KEY,
  "doctorId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "patientId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Doctor Regimen Recommendations (1-click patient protocol acceptance)
CREATE TABLE IF NOT EXISTS regimen_proposal (
  id TEXT PRIMARY KEY,
  "doctorId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "patientId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT NOT NULL,
  frequency TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_user_role ON "user"(role);
CREATE INDEX IF NOT EXISTS idx_doctor_profile_user ON doctor_profile("userId");
CREATE INDEX IF NOT EXISTS idx_doc_patient_doc ON doctor_patient("doctorId");
CREATE INDEX IF NOT EXISTS idx_doc_patient_patient ON doctor_patient("patientId");
CREATE INDEX IF NOT EXISTS idx_consult_msg_rel ON consultation_message("relationshipId");
CREATE INDEX IF NOT EXISTS idx_consult_msg_created ON consultation_message("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_note_patient ON clinical_note("patientId");
CREATE INDEX IF NOT EXISTS idx_regimen_prop_patient ON regimen_proposal("patientId");
