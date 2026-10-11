"use server"

import { auth } from "@/lib/auth"
import { query } from "@/lib/db"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

async function getAuthUser(): Promise<{ id: string; role: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  
  // Fetch current role directly from DB
  const res = await query(`SELECT role FROM "user" WHERE id = $1 LIMIT 1`, [session.user.id])
  const role = res.rows[0]?.role ?? "patient"
  return { id: session.user.id, role }
}

export async function getDoctorProfile() {
  const { id: userId } = await getAuthUser()
  
  // Ensure doctor profile exists
  let res = await query(
    `SELECT dp.*, u.name, u.email, u.image 
     FROM doctor_profile dp
     JOIN "user" u ON u.id = dp."userId"
     WHERE dp."userId" = $1 LIMIT 1`,
    [userId]
  )
  
  if (res.rows.length === 0) {
    const id = randomUUID()
    await query(
      `INSERT INTO doctor_profile (id, "userId", "licenseNumber", specialty, "clinicName", bio, verified, "createdAt", "updatedAt")
       VALUES ($1, $2, 'MED-TRICH-9841', 'Trichology & Hair Restoration Specialist', 'Densify Clinical Research', 'Board-certified clinical trichologist specializing in androgenetic alopecia and follicle revitalization.', true, now(), now())`,
      [id, userId]
    )
    res = await query(
      `SELECT dp.*, u.name, u.email, u.image 
       FROM doctor_profile dp
       JOIN "user" u ON u.id = dp."userId"
       WHERE dp."userId" = $1 LIMIT 1`,
      [userId]
    )
  }

  const profile = res.rows[0]
  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.name || "Dr. Aris Thorne",
    email: profile.email,
    licenseNumber: profile.licenseNumber,
    specialty: profile.specialty,
    clinicName: profile.clinicName,
    bio: profile.bio,
    consultFee: Number(profile.consultFee || 150),
    verified: Boolean(profile.verified),
  }
}

export interface CaseloadPatient {
  id: string
  name: string
  email: string
  avatar?: string
  norwoodStage: string
  adherenceRate: number
  densityDelta: string
  activeMedications: string[]
  hasVaultAccess: boolean
  hasLabAccess: boolean
  lastActive: string
  pendingReview: boolean
  unreadMessagesCount: number
}

export async function getPatientCaseload(): Promise<CaseloadPatient[]> {
  const { id: doctorUserId } = await getAuthUser()

  // Find relationships in DB
  const res = await query(
    `SELECT dp.id as "relationshipId", dp."patientId", dp."vaultAccessGranted", dp."labAccessGranted",
            u.id as "userId", u.name, u.email, u.image,
            p.tier, p."displayName", p.gender
     FROM doctor_patient dp
     JOIN "user" u ON u.id = dp."patientId"
     LEFT JOIN profile p ON p."userId" = u.id
     WHERE dp."doctorId" = $1`,
    [doctorUserId]
  )

  // Demo baseline patients to guarantee a rich caseload view
  const demoPatients: CaseloadPatient[] = [
    {
      id: "patient-liam",
      name: "Liam O'Connell",
      email: "liam.oconnell@example.com",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
      norwoodStage: "NW 3 Vertex",
      adherenceRate: 96,
      densityDelta: "+4.2%",
      activeMedications: ["Finasteride 1mg", "Minoxidil 5% Topical", "Ketoconazole 2%"],
      hasVaultAccess: true,
      hasLabAccess: true,
      lastActive: "Today, 10:14 AM",
      pendingReview: true,
      unreadMessagesCount: 2,
    },
    {
      id: "patient-sarah",
      name: "Sarah Chen",
      email: "sarah.chen@example.com",
      avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80",
      norwoodStage: "Ludwig Grade I-2",
      adherenceRate: 98,
      densityDelta: "+7.8%",
      activeMedications: ["Oral Minoxidil 1.25mg", "Spironolactone 50mg", "Iron / Ferritin Support"],
      hasVaultAccess: true,
      hasLabAccess: true,
      lastActive: "Yesterday",
      pendingReview: false,
      unreadMessagesCount: 0,
    },
    {
      id: "patient-dan",
      name: "Daniel Holere",
      email: "dan.holere@example.com",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
      norwoodStage: "NW 4",
      adherenceRate: 84,
      densityDelta: "-1.1%",
      activeMedications: ["Dutasteride 0.5mg", "Microneedling 1.0mm weekly"],
      hasVaultAccess: true,
      hasLabAccess: false,
      lastActive: "3 days ago",
      pendingReview: true,
      unreadMessagesCount: 1,
    },
    {
      id: "patient-marcus",
      name: "Marcus Vance",
      email: "marcus.v@example.com",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
      norwoodStage: "NW 2 Mature",
      adherenceRate: 92,
      densityDelta: "+3.0%",
      activeMedications: ["Finasteride 1mg"],
      hasVaultAccess: false,
      hasLabAccess: true,
      lastActive: "5 days ago",
      pendingReview: false,
      unreadMessagesCount: 0,
    }
  ]

  // Map any real DB patients and prepend them
  const realPatients: CaseloadPatient[] = res.rows.map((row: any) => ({
    id: row.userId,
    name: row.displayName || row.name || "Patient",
    email: row.email,
    avatar: row.image || undefined,
    norwoodStage: "NW 3",
    adherenceRate: 95,
    densityDelta: "+4.0%",
    activeMedications: ["Finasteride 1mg", "Minoxidil 5%"],
    hasVaultAccess: Boolean(row.vaultAccessGranted),
    hasLabAccess: Boolean(row.labAccessGranted),
    lastActive: "Today",
    pendingReview: true,
    unreadMessagesCount: 1,
  }))

  return [...realPatients, ...demoPatients]
}

export async function getPatientDossier(patientId: string) {
  await getAuthUser()

  // Fetch real photos if this is a real user
  const photosRes = await query(
    `SELECT id, "dataUrl", angle, "takenAt" FROM progress_photo WHERE "userId" = $1 ORDER BY "takenAt" ASC`,
    [patientId]
  )

  // Fetch real medications
  const medsRes = await query(
    `SELECT id, name, dose, frequency, active FROM medication WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
    [patientId]
  )

  // Fetch real SOAP note
  const noteRes = await query(
    `SELECT id, subjective, objective, assessment, plan, "updatedAt" 
     FROM clinical_note 
     WHERE "patientId" = $1 
     ORDER BY "updatedAt" DESC LIMIT 1`,
    [patientId]
  )

  // Fetch pending proposals
  const proposalsRes = await query(
    `SELECT id, name, dose, frequency, notes, status, "createdAt" 
     FROM regimen_proposal 
     WHERE "patientId" = $1 
     ORDER BY "createdAt" DESC`,
    [patientId]
  )

  return {
    patientId,
    photos: photosRes.rows,
    medications: medsRes.rows,
    clinicalNote: noteRes.rows[0] || null,
    proposals: proposalsRes.rows,
  }
}

export async function saveClinicalSOAPNote(data: {
  patientId: string
  subjective: string
  objective: string
  assessment: string
  plan: string
}) {
  const { id: doctorUserId } = await getAuthUser()

  const existing = await query(
    `SELECT id FROM clinical_note WHERE "doctorId" = $1 AND "patientId" = $2 LIMIT 1`,
    [doctorUserId, data.patientId]
  )

  if (existing.rows.length > 0) {
    await query(
      `UPDATE clinical_note 
       SET subjective = $1, objective = $2, assessment = $3, plan = $4, "updatedAt" = now()
       WHERE id = $5`,
      [data.subjective, data.objective, data.assessment, data.plan, existing.rows[0].id]
    )
  } else {
    const id = randomUUID()
    await query(
      `INSERT INTO clinical_note (id, "doctorId", "patientId", subjective, objective, assessment, plan, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`,
      [id, doctorUserId, data.patientId, data.subjective, data.objective, data.assessment, data.plan]
    )
  }

  revalidatePath("/doctor")
  return { success: true }
}

export async function proposeRegimen(data: {
  patientId: string
  name: string
  dose: string
  frequency: string
  notes?: string
}) {
  const { id: doctorUserId } = await getAuthUser()

  const id = randomUUID()
  await query(
    `INSERT INTO regimen_proposal (id, "doctorId", "patientId", name, dose, frequency, notes, status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', now(), now())`,
    [id, doctorUserId, data.patientId, data.name, data.dose, data.frequency, data.notes || null]
  )

  // Ensure relationship exists
  let relRes = await query(
    `SELECT id FROM doctor_patient WHERE "doctorId" = $1 AND "patientId" = $2 LIMIT 1`,
    [doctorUserId, data.patientId]
  )
  let relId = relRes.rows[0]?.id
  if (!relId) {
    relId = randomUUID()
    await query(
      `INSERT INTO doctor_patient (id, "doctorId", "patientId", status, "createdAt") VALUES ($1, $2, $3, 'active', now())`,
      [relId, doctorUserId, data.patientId]
    )
  }

  // Inject system/doctor proposal message into consultation
  const msgId = randomUUID()
  await query(
    `INSERT INTO consultation_message (id, "relationshipId", "senderId", "senderRole", content, "attachmentType", "attachmentPayload", "createdAt")
     VALUES ($1, $2, $3, 'doctor', $4, 'regimen_proposal', $5, now())`,
    [
      msgId,
      relId,
      doctorUserId,
      `Clinical Protocol Proposal: Recommended starting ${data.name} (${data.dose}) - ${data.frequency}.`,
      JSON.stringify({
        proposalId: id,
        name: data.name,
        dose: data.dose,
        frequency: data.frequency,
        notes: data.notes,
      })
    ]
  )

  revalidatePath("/doctor")
  revalidatePath("/")
  return { success: true, proposalId: id }
}

export async function acceptRegimenProposal(proposalId: string) {
  const { id: patientUserId } = await getAuthUser()

  const res = await query(
    `SELECT * FROM regimen_proposal WHERE id = $1 AND "patientId" = $2 LIMIT 1`,
    [proposalId, patientUserId]
  )

  if (res.rows.length === 0) throw new Error("Proposal not found")
  const proposal = res.rows[0]

  // Update proposal status
  await query(`UPDATE regimen_proposal SET status = 'accepted', "updatedAt" = now() WHERE id = $1`, [proposalId])

  // Insert into active medication table
  const medId = randomUUID()
  const today = new Date().toISOString().split("T")[0]
  await query(
    `INSERT INTO medication (id, "userId", name, dose, frequency, "startDate", notes, active, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, now(), now())`,
    [medId, patientUserId, proposal.name, proposal.dose, proposal.frequency, today, proposal.notes]
  )

  revalidatePath("/")
  revalidatePath("/doctor")
  return { success: true }
}
