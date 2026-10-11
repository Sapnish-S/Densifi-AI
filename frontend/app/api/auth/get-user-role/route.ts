import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json({ role: "patient" })
    }

    const res = await query(
      `SELECT role FROM "user" WHERE email = $1 LIMIT 1`,
      [email]
    )

    const role = res.rows[0]?.role ?? "patient"
    return NextResponse.json({ role })
  } catch (err: any) {
    console.error("Error fetching user role:", err)
    return NextResponse.json({ role: "patient" })
  }
}
