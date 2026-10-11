import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getDoctorProfile, getPatientCaseload } from "@/app/actions/doctor"
import { DoctorPortalClient } from "@/components/doctor/doctor-portal-client"

export const dynamic = "force-dynamic"

export default async function DoctorPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/landing")

  const [doctorProfile, caseload] = await Promise.all([
    getDoctorProfile(),
    getPatientCaseload(),
  ])

  return (
    <DoctorPortalClient
      doctor={doctorProfile}
      initialPatients={caseload}
    />
  )
}
