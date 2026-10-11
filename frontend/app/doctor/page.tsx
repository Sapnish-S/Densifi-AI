import { redirect } from "next/navigation"
import { requireDoctor, getPatientCaseload } from "@/app/actions/doctor"
import { DoctorPortalClient } from "@/components/doctor/doctor-portal-client"

export const dynamic = "force-dynamic"

export default async function DoctorPage() {
  // Middleware already routes by role; this is the server-side guard.
  const doctor = await requireDoctor().catch(() => null)
  if (!doctor) redirect("/")

  const patients = await getPatientCaseload()
  return <DoctorPortalClient doctor={doctor} patients={patients} />
}
