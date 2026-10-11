"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Lock, LogOut, Stethoscope, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DensifyLogomark } from "@/components/densify-logomark"
import { authClient } from "@/lib/auth-client"
import { getPatientRecord, type CaseloadPatient, type DoctorUser, type PatientRecord } from "@/app/actions/doctor"

export function DoctorPortalClient({ doctor, patients }: { doctor: DoctorUser; patients: CaseloadPatient[] }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [record, setRecord] = useState<PatientRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = patients.find((p) => p.id === selectedId) ?? null

  async function openPatient(id: string) {
    setSelectedId(id)
    setRecord(null)
    setError(null)
    setLoading(true)
    try {
      setRecord(await getPatientRecord(id))
    } catch {
      setError("Couldn't load this patient's record.")
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-40 h-16 border-b border-border/70 bg-card/85 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <DensifyLogomark variant="navbar" height={44} />
          <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-primary/10 border-primary/30 text-primary">
            <Stethoscope className="h-3.5 w-3.5" />
            Doctor Portal
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right text-xs">
            <span className="font-semibold">{doctor.name}</span>
            {(doctor.specialty || doctor.clinicName) && (
              <span className="text-[10px] text-muted-foreground">
                {[doctor.specialty, doctor.clinicName].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="h-8 gap-1.5 text-xs">
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row">
        <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r border-border/70 bg-card/40 p-4 shrink-0">
          <p className="flex items-center gap-2 px-2 mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5" /> Patients ({patients.length})
          </p>
          {patients.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">No patients are linked to your account yet.</p>
          ) : (
            <nav className="space-y-1">
              {patients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openPatient(p.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-sm text-sm transition-colors ${
                    p.id === selectedId ? "bg-primary/15 text-primary font-semibold" : "hover:bg-muted/50"
                  }`}
                >
                  <p className="truncate">{p.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{p.email}</p>
                </button>
              ))}
            </nav>
          )}
        </aside>

        <main className="flex-1 p-4 sm:p-8 space-y-6">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a patient to view the data they've shared with you.</p>
          ) : (
            <>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{selected.name}</h1>
                <p className="text-xs text-muted-foreground">
                  Linked {new Date(selected.linkedAt).toLocaleDateString()}
                </p>
              </div>
              {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {record && (
                <>
                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold">Progress photos</h2>
                    {record.photos === null ? (
                      <NotShared />
                    ) : record.photos.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No photos yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {record.photos.map((ph) => (
                          <figure key={ph.id} className="rounded-sm border border-border/60 overflow-hidden">
                            <img src={ph.dataUrl} alt={ph.label ?? "Progress photo"} className="aspect-square w-full object-cover" />
                            <figcaption className="px-2 py-1.5 text-[11px] text-muted-foreground">
                              {ph.label ?? "photo"} · {new Date(ph.takenAt).toLocaleDateString()}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="space-y-3">
                    <h2 className="text-sm font-semibold">Lab reports</h2>
                    {record.labs === null ? (
                      <NotShared />
                    ) : record.labs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No lab reports yet.</p>
                    ) : (
                      <table className="w-full text-left text-xs border border-border/60">
                        <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                          <tr>
                            <th className="py-2 px-3">Report</th>
                            <th className="py-2 px-3">Date</th>
                            <th className="py-2 px-3">DHT</th>
                            <th className="py-2 px-3">Free T</th>
                            <th className="py-2 px-3">Ferritin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {record.labs.map((l) => (
                            <tr key={l.id}>
                              <td className="py-2 px-3">{l.title}</td>
                              <td className="py-2 px-3">{new Date(l.uploadedAt).toLocaleDateString()}</td>
                              <td className="py-2 px-3">{l.dht ?? "—"}</td>
                              <td className="py-2 px-3">{l.freeT ?? "—"}</td>
                              <td className="py-2 px-3">{l.ferritin ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function NotShared() {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Lock className="h-3.5 w-3.5" /> The patient hasn't shared this with you.
    </p>
  )
}
