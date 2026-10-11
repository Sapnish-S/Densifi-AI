import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { randomUUID } from "crypto"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, role, specialty, licenseNumber } = body

    if (!email || !role) {
      return NextResponse.json({ error: "Missing email or role" }, { status: 400 })
    }

    const assignedRole = role === "doctor" ? "doctor" : "patient"

    // 1. Update role on the user record and ensure verified status
    const res = await query(
      `UPDATE "user" SET role = $1, "emailVerified" = true, "updatedAt" = now() WHERE email = $2 RETURNING id`,
      [assignedRole, email]
    )

    if (res.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userId = res.rows[0].id

    // 2. If registering as a doctor, ensure a doctor_profile exists
    if (assignedRole === "doctor") {
      const docId = randomUUID()
      const license = licenseNumber || "MED-TRICH-9841"
      const docSpecialty = specialty || "Trichology & Hair Restoration Specialist"

      await query(
        `INSERT INTO doctor_profile (id, "userId", "licenseNumber", specialty, "clinicName", bio, verified, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'Densify Clinical Research', 'Board-certified clinician specializing in scalp trichoscopy and follicle restoration.', true, now(), now())
         ON CONFLICT ("userId") DO UPDATE SET 
           "licenseNumber" = EXCLUDED."licenseNumber",
           specialty = EXCLUDED.specialty,
           "updatedAt" = now()`,
        [docId, userId, license, docSpecialty]
      )
    }

    return NextResponse.json({ success: true, role: assignedRole })
  } catch (err: any) {
    console.error("Error setting user role:", err)
    return NextResponse.json({ error: err.message || "Failed to set role" }, { status: 500 })
  }
}
