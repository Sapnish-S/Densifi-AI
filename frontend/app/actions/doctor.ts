"use server"

import { auth } from "@/lib/auth"
import { query } from "@/lib/db"
import { headers } from "next/headers"

export interface DoctorUser {
  id: string
  name: string
  email: string
  specialty: string | null
  clinicName: string | null
}

// Role is read from the DB, not the session cookie cache, so a demotion takes effect immediately.
export async function requireDoctor(): Promise<DoctorUser> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  const res = await query(
    `SELECT u.role, u.name, u.email, d.specialty, d."clinicName"
     FROM "user" u
     LEFT JOIN doctor_profile d ON d."userId" = u.id
     WHERE u.id = $1 LIMIT 1`,
    [session.user.id],
  )
  const row = res.rows[0]
  if (row?.role !== "doctor") throw new Error("Forbidden")
  return {
    id: session.user.id,
    name: row.name,
    email: row.email,
    specialty: row.specialty ?? null,
    clinicName: row.clinicName ?? null,
  }
}

export interface CaseloadPatient {
  id: string
  name: string
  email: string
  hasVaultAccess: boolean
  hasLabAccess: boolean
  linkedAt: string
}

export async function getPatientCaseload(): Promise<CaseloadPatient[]> {
  const doctor = await requireDoctor()
  const res = await query(
    `SELECT u.id, COALESCE(p."displayName", u.name) AS name, u.email,
            dp."vaultAccessGranted", dp."labAccessGranted", dp."createdAt"
     FROM doctor_patient dp
     JOIN "user" u ON u.id = dp."patientId"
     LEFT JOIN profile p ON p."userId" = u.id
     WHERE dp."doctorId" = $1 AND dp.status = 'active' AND u.role = 'patient'
     ORDER BY dp."createdAt" DESC`,
    [doctor.id],
  )
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name ?? "Patient",
    email: r.email,
    hasVaultAccess: Boolean(r.vaultAccessGranted),
    hasLabAccess: Boolean(r.labAccessGranted),
    linkedAt: new Date(r.createdAt).toISOString(),
  }))
}

export interface PatientRecord {
  photos: { id: string; dataUrl: string; label: string | null; takenAt: string }[] | null
  labs: { id: string; title: string; uploadedAt: string; dht: number | null; freeT: number | null; ferritin: number | null }[] | null
}

// null means the patient hasn't granted that scope.
export async function getPatientRecord(patientId: string): Promise<PatientRecord> {
  const doctor = await requireDoctor()
  const link = await query(
    `SELECT "vaultAccessGranted", "labAccessGranted" FROM doctor_patient
     WHERE "doctorId" = $1 AND "patientId" = $2 AND status = 'active' LIMIT 1`,
    [doctor.id, patientId],
  )
  if (link.rows.length === 0) throw new Error("Forbidden")
  const { vaultAccessGranted, labAccessGranted } = link.rows[0]

  const [photos, labs] = await Promise.all([
    vaultAccessGranted
      ? query(
          `SELECT id, "dataUrl", angle AS "label", "takenAt" FROM progress_photo WHERE "userId" = $1 ORDER BY "takenAt" DESC`,
          [patientId],
        )
      : null,
    labAccessGranted
      ? query(
          `SELECT id, label AS title, "reportDate" AS "uploadedAt", dht, "freeT", ferritin FROM lab_report WHERE "userId" = $1 ORDER BY "reportDate" DESC`,
          [patientId],
        )
      : null,
  ])
  return {
    photos: photos ? (photos.rows as PatientRecord["photos"]) : null,
    labs: labs ? (labs.rows as PatientRecord["labs"]) : null,
  }
}
