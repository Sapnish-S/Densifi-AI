"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2, Search, Stethoscope } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  connectDoctor,
  disconnectDoctor,
  getMyDoctors,
  listDoctors,
  updateSharing,
  type DirectoryDoctor,
  type MyDoctor,
  type Sharing,
} from "@/app/actions/doctor-links"

const SCOPES: { key: keyof Sharing; label: string; hint: string }[] = [
  { key: "photos", label: "Progress photos", hint: "Your Progression Vault scans" },
  { key: "labs", label: "Lab reports", hint: "DHT, free testosterone, ferritin" },
]

function initials(name: string) {
  return name
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function subtitle(d: DirectoryDoctor) {
  return [d.specialty, d.clinicName].filter(Boolean).join(" · ") || "Doctor"
}

export function DoctorPanel() {
  const [doctors, setDoctors] = useState<DirectoryDoctor[] | null>(null)
  const [mine, setMine] = useState<MyDoctor[]>([])
  const [search, setSearch] = useState("")
  const [connecting, setConnecting] = useState<DirectoryDoctor | null>(null)
  const [consent, setConsent] = useState<Sharing>({ photos: false, labs: false })
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  async function refresh() {
    const [all, linked] = await Promise.all([listDoctors(), getMyDoctors()])
    setDoctors(all)
    setMine(linked)
  }

  useEffect(() => {
    refresh().catch(() => setDoctors([]))
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function run(key: string, fn: () => Promise<void>, done: string) {
    setBusy(key)
    try {
      await fn()
      showToast(done)
    } catch {
      showToast("Something went wrong. Please try again.")
    } finally {
      await refresh().catch(() => {})
      setBusy(null)
    }
  }

  function openConnect(d: DirectoryDoctor) {
    setConsent({ photos: false, labs: false })
    setConnecting(d)
  }

  async function confirmConnect() {
    if (!connecting) return
    const d = connecting
    setConnecting(null)
    await run(d.id, () => connectDoctor(d.id, consent), `Connected with ${d.name}`)
  }

  const linkedIds = new Set(mine.map((d) => d.id))
  const q = search.trim().toLowerCase()
  const directory = (doctors ?? []).filter(
    (d) => !linkedIds.has(d.id) && (!q || `${d.name} ${d.specialty ?? ""} ${d.clinicName ?? ""}`.toLowerCase().includes(q)),
  )

  return (
    <div className="relative w-full space-y-8">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-foreground text-background px-5 py-3 rounded-lg shadow-xl">
          <CheckCircle2 className="h-5 w-5" />
          <p className="text-sm font-medium">{toast}</p>
        </div>
      )}

      <Dialog open={connecting !== null} onOpenChange={(open) => !open && setConnecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect with {connecting?.name}</DialogTitle>
            <DialogDescription>
              Choose what this doctor can see. Nothing is shared unless you tick it, and you can change this any time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {SCOPES.map((s) => (
              <label key={s.key} className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={consent[s.key]}
                  onChange={(e) => setConsent((c) => ({ ...c, [s.key]: e.target.checked }))}
                />
                <span>
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnecting(null)}>
              Cancel
            </Button>
            <Button onClick={confirmConnect}>Connect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {mine.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">My doctors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mine.map((d) => (
              <Card key={d.id} className="bg-card border-border">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={d.name} />
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{d.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{subtitle(d)}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Shared with this doctor</p>
                    {SCOPES.map((s) => (
                      <label key={s.key} className="flex items-center justify-between text-sm cursor-pointer">
                        <span>{s.label}</span>
                        <input
                          type="checkbox"
                          role="switch"
                          aria-label={`Share ${s.label.toLowerCase()} with ${d.name}`}
                          className="h-4 w-4 accent-primary"
                          checked={d.sharing[s.key]}
                          disabled={busy === d.id}
                          onChange={(e) => {
                            const sharing = { ...d.sharing, [s.key]: e.target.checked }
                            // Flip immediately; run() refreshes from the server (reverting on failure).
                            setMine((prev) => prev.map((m) => (m.id === d.id ? { ...m, sharing } : m)))
                            run(
                              d.id,
                              () => updateSharing(d.id, sharing),
                              sharing[s.key] ? `${s.label} shared with ${d.name}` : `${s.label} no longer shared`,
                            )
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={busy === d.id}
                    onClick={() => run(d.id, () => disconnectDoctor(d.id), `Disconnected from ${d.name}`)}
                  >
                    Disconnect
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Find a doctor</h2>
          <p className="text-sm text-muted-foreground">Connect with a doctor on Densify and choose what they can see.</p>
        </div>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, specialty or clinic"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {doctors === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : directory.length === 0 ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            {q
              ? "No doctors match your search."
              : mine.length > 0
                ? "You're connected with every doctor on Densify."
                : "No doctors are available yet."}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {directory.map((d) => (
              <Card key={d.id} className="bg-card border-border">
                <CardContent className="p-5 flex flex-col items-center text-center gap-3">
                  <Avatar name={d.name} large />
                  <div>
                    <h3 className="font-semibold">{d.name}</h3>
                    <p className="text-xs text-muted-foreground">{subtitle(d)}</p>
                  </div>
                  <Button className="w-full" disabled={busy === d.id} onClick={() => openConnect(d)}>
                    {busy === d.id ? "Connecting…" : "Connect"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <div
      className={`rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold shrink-0 ${
        large ? "w-14 h-14 text-lg" : "w-10 h-10 text-sm"
      }`}
    >
      {initials(name)}
    </div>
  )
}
