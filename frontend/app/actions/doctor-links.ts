"use server"

// Patient side of doctor_patient: find doctors, connect, choose what to share, disconnect.
// Links are created by the patient only, and sharing is off unless the patient ticks it.

import { auth } from "@/lib/auth"
import { query } from "@/lib/db"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

export interface Sharing {
  photos: boolean
  labs: boolean
}

export interface DirectoryDoctor {
  id: string
  name: string
  specialty: string | null
  clinicName: string | null
}

export interface MyDoctor extends DirectoryDoctor {
  sharing: Sharing
  linkedAt: string
}

async function requirePatient(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  const res = await query(`SELECT role FROM "user" WHERE id = $1 LIMIT 1`, [session.user.id])
  if (res.rows[0]?.role !== "patient") throw new Error("Forbidden")
  return session.user.id
}

// Never send a doctor's email to patients.
export async function listDoctors(): Promise<DirectoryDoctor[]> {
  await requirePatient()
  const res = await query(
    `SELECT u.id, u.name, d.specialty, d."clinicName"
     FROM "user" u
     LEFT JOIN doctor_profile d ON d."userId" = u.id
     WHERE u.role = 'doctor' AND u."emailVerified" = true
     ORDER BY u.name`,
  )
  return res.rows.map((r) => ({ id: r.id, name: r.name, specialty: r.specialty ?? null, clinicName: r.clinicName ?? null }))
}

export async function getMyDoctors(): Promise<MyDoctor[]> {
  const patientId = await requirePatient()
  const res = await query(
    `SELECT u.id, u.name, d.specialty, d."clinicName",
            dp."vaultAccessGranted", dp."labAccessGranted", dp."createdAt"
     FROM doctor_patient dp
     JOIN "user" u ON u.id = dp."doctorId" AND u.role = 'doctor'
     LEFT JOIN doctor_profile d ON d."userId" = u.id
     WHERE dp."patientId" = $1 AND dp.status = 'active'
     ORDER BY dp."createdAt" DESC`,
    [patientId],
  )
  return res.rows.map((r) => ({
    id: r.id,
    name: r.name,
    specialty: r.specialty ?? null,
    clinicName: r.clinicName ?? null,
    sharing: { photos: Boolean(r.vaultAccessGranted), labs: Boolean(r.labAccessGranted) },
    linkedAt: new Date(r.createdAt).toISOString(),
  }))
}

export async function connectDoctor(doctorId: string, sharing: Sharing) {
  const patientId = await requirePatient()
  const doc = await query(
    `SELECT 1 FROM "user" WHERE id = $1 AND role = 'doctor' AND "emailVerified" = true LIMIT 1`,
    [doctorId],
  )
  if (doc.rows.length === 0) throw new Error("Doctor not found")
  // Reconnecting after a disconnect reactivates the same row.
  await query(
    `INSERT INTO doctor_patient (id, "doctorId", "patientId", status, "vaultAccessGranted", "labAccessGranted")
     VALUES ($1, $2, $3, 'active', $4, $5)
     ON CONFLICT ("doctorId", "patientId") DO UPDATE SET
       status = 'active',
       "vaultAccessGranted" = EXCLUDED."vaultAccessGranted",
       "labAccessGranted" = EXCLUDED."labAccessGranted",
       "createdAt" = CASE WHEN doctor_patient.status = 'active' THEN doctor_patient."createdAt" ELSE now() END`,
    [randomUUID(), doctorId, patientId, sharing.photos, sharing.labs],
  )
  revalidatePath("/")
}

export async function updateSharing(doctorId: string, sharing: Sharing) {
  const patientId = await requirePatient()
  await query(
    `UPDATE doctor_patient SET "vaultAccessGranted" = $3, "labAccessGranted" = $4
     WHERE "doctorId" = $1 AND "patientId" = $2 AND status = 'active'`,
    [doctorId, patientId, sharing.photos, sharing.labs],
  )
  revalidatePath("/")
}

// Disconnecting also clears every share flag, so nothing stays visible to the doctor.
export async function disconnectDoctor(doctorId: string) {
  const patientId = await requirePatient()
  await query(
    `UPDATE doctor_patient SET status = 'concluded', "vaultAccessGranted" = false, "labAccessGranted" = false
     WHERE "doctorId" = $1 AND "patientId" = $2`,
    [doctorId, patientId],
  )
  revalidatePath("/")
}
