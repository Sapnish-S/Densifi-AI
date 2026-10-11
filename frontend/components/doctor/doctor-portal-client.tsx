"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Users,
  Search,
  Activity,
  FileText,
  MessageSquare,
  ShieldCheck,
  Send,
  Pill,
  Sparkles,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Eye,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Stethoscope,
  Filter,
  Save,
  Check,
  CornerDownLeft,
  Calendar,
  Lock,
  Unlock,
  Maximize2
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DensifyLogomark } from "@/components/densify-logomark"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CaseloadPatient, saveClinicalSOAPNote, proposeRegimen } from "@/app/actions/doctor"
import { switchUserRole } from "@/app/actions/profile"

interface DoctorPortalClientProps {
  doctor: {
    id: string
    name: string
    email: string
    licenseNumber: string
    specialty: string
    clinicName: string
    bio: string
    consultFee: number
    verified: boolean
  }
  initialPatients: CaseloadPatient[]
}

export function DoctorPortalClient({ doctor, initialPatients }: DoctorPortalClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"caseload" | "inspection" | "consultation" | "prescriptions">("caseload")
  const [patients, setPatients] = useState<CaseloadPatient[]>(initialPatients)
  const [selectedPatientId, setSelectedPatientId] = useState<string>(initialPatients[0]?.id || "patient-liam")
  const [searchQuery, setSearchQuery] = useState("")
  const [filterSeverity, setFilterSeverity] = useState<"all" | "high" | "moderate" | "stable">("all")
  const [isSwitchingRole, setIsSwitchingRole] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // SOAP Note State
  const [soap, setSoap] = useState({
    subjective: "Patient reports consistent adherence to topical regimen. Mentions mild shed in week 3 which has now stabilized. Desires increased crown vertex coverage.",
    objective: "Trichoscopy reveals mild miniaturization in vertex scalp (ratio 22%). Frontal hairline stable. Follicular density measured at 127 FU/cm² (up from 118 FU/cm² baseline). Scalp inflammation minimal.",
    assessment: "Androgenetic Alopecia (Norwood 3 Vertex), showing positive early therapeutic response to 5% Minoxidil + 1mg Finasteride. Follicular miniaturization is decelerating.",
    plan: "1. Continue Finasteride 1mg PO QD.\n2. Recommend transition to Oral Minoxidil 2.5mg for improved systemic efficacy.\n3. Add Ketoconazole 2% shampoo 3x weekly.\n4. Repeat trichoscopy vault scan in 90 days."
  })
  const [isSavingSoap, setIsSavingSoap] = useState(false)

  // Prescribe Regimen Dialog
  const [prescribeOpen, setPrescribeOpen] = useState(false)
  const [newMed, setNewMed] = useState({
    name: "Oral Minoxidil",
    dose: "2.5mg daily",
    frequency: "Once daily in the morning",
    notes: "Transition from topical minoxidil to optimize compliance and follicular absorption."
  })
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false)

  // Consultation Chat State
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string
    sender: "doctor" | "patient" | "system"
    text: string
    time: string
    isReport?: boolean
    reportData?: any
    isProposal?: boolean
    proposalData?: any
  }>>([
    {
      id: "m-1",
      sender: "patient",
      text: "Dr. Thorne, I just completed my Month 6 Progression Vault scan and attached the AI analysis report. Can we review the crown vertex density?",
      time: "10:14 AM",
    },
    {
      id: "m-2",
      sender: "patient",
      text: "Monthly Scalp Vault Analysis (Month 6)",
      time: "10:15 AM",
      isReport: true,
      reportData: {
        title: "Bedrock AI Follicular Density Report",
        score: "7.8/10 (+1.4)",
        status: "Clinically Improved",
        densityDelta: "+7.8%",
        baselineFU: "118/cm²",
        currentFU: "127/cm²",
        dht: "240 pg/mL (suppressed)",
        ferritin: "82 ng/mL (optimal)"
      }
    },
    {
      id: "m-3",
      sender: "doctor",
      text: "Hello Liam, excellent progress on the vertex. Your follicular density is up +7.8% and hair shaft diameter is increasing nicely. I reviewed your lab markers and DHT is well-suppressed.",
      time: "10:30 AM",
    }
  ])
  const [typedMessage, setTypedMessage] = useState("")

  const selectedPatient = patients.find(p => p.id === selectedPatientId) || patients[0]

  const showNotification = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleRoleSwitch = async () => {
    setIsSwitchingRole(true)
    try {
      await switchUserRole("patient")
      showNotification("Switched to Patient view. Redirecting...")
      router.push("/")
      router.refresh()
    } catch {
      showNotification("Failed to switch role.")
    } finally {
      setIsSwitchingRole(false)
    }
  }

  const handleSaveSOAP = async () => {
    setIsSavingSoap(true)
    try {
      await saveClinicalSOAPNote({
        patientId: selectedPatient.id,
        ...soap
      })
      showNotification("Clinical SOAP note successfully recorded in patient chart.")
    } catch {
      showNotification("Failed to save clinical note.")
    } finally {
      setIsSavingSoap(false)
    }
  }

  const handleSendProposal = async () => {
    setIsSubmittingProposal(true)
    try {
      await proposeRegimen({
        patientId: selectedPatient.id,
        ...newMed
      })
      
      // Add proposal card into chat
      setChatMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "doctor",
          text: `Prescription Protocol Proposal: ${newMed.name} (${newMed.dose})`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isProposal: true,
          proposalData: { ...newMed, status: "pending" }
        }
      ])
      
      setPrescribeOpen(false)
      showNotification(`Protocol proposal for ${newMed.name} sent to patient.`)
    } catch {
      showNotification("Failed to dispatch protocol proposal.")
    } finally {
      setIsSubmittingProposal(false)
    }
  }

  const handleSendMessage = () => {
    if (!typedMessage.trim()) return
    setChatMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: "doctor",
        text: typedMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ])
    setTypedMessage("")
  }

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.email.toLowerCase().includes(searchQuery.toLowerCase())
    if (filterSeverity === "high") return matchesSearch && p.adherenceRate < 90
    if (filterSeverity === "moderate") return matchesSearch && p.norwoodStage.includes("3")
    if (filterSeverity === "stable") return matchesSearch && p.adherenceRate >= 95
    return matchesSearch
  })

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-lg border border-primary/40 bg-card/95 px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Clinical Navigation Bar */}
      <header className="sticky top-0 z-40 h-16 border-b border-border/70 bg-card/85 backdrop-blur-xl px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/doctor" className="flex items-center gap-2.5">
            <DensifyLogomark variant="navbar" height={44} />
          </Link>
          <div className="h-5 w-px bg-border/80 hidden sm:block" />
          <Badge variant="outline" className="hidden sm:inline-flex items-center gap-1.5 py-1 px-2.5 text-xs font-semibold bg-primary/10 border-primary/30 text-primary">
            <Stethoscope className="h-3.5 w-3.5" />
            Clinician Portal
          </Badge>
        </div>

        {/* Doctor Info & Switch to Patient Mode */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRoleSwitch}
            disabled={isSwitchingRole}
            className="h-8 gap-1.5 text-xs border-border/80 hover:bg-accent hover:border-foreground/40 transition-all"
            title="Switch into Patient view for this account"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Switch to Patient View</span>
            <span className="sm:hidden">Patient</span>
          </Button>

          <div className="flex items-center gap-2.5 pl-2 border-l border-border/70">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-primary/20">
              AT
            </div>
            <div className="hidden md:flex flex-col text-left text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1">
                {doctor.name}
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
              </span>
              <span className="text-[10px] text-muted-foreground">{doctor.specialty}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Clinician Workspace */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Clinician Sidebar */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border/70 bg-card/40 p-4 flex md:flex-col justify-between shrink-0">
          <div className="space-y-6 w-full">
            <div>
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Clinical Workflow
              </p>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab("caseload")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "caseload"
                      ? "bg-primary/15 text-primary font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>Patient Caseload</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4">
                    {patients.length}
                  </Badge>
                </button>

                <button
                  onClick={() => setActiveTab("inspection")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "inspection"
                      ? "bg-primary/15 text-primary font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  <span>Clinical Inspection</span>
                </button>

                <button
                  onClick={() => setActiveTab("consultation")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "consultation"
                      ? "bg-primary/15 text-primary font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Consultation Room</span>
                  {selectedPatient.unreadMessagesCount > 0 && (
                    <span className="ml-auto flex h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>

                <button
                  onClick={() => setActiveTab("prescriptions")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === "prescriptions"
                      ? "bg-primary/15 text-primary font-semibold shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Pill className="h-4 w-4" />
                  <span>Rx Protocol Manager</span>
                </button>
              </nav>
            </div>

            {/* Selected Patient Quick Switcher */}
            <div className="hidden md:block pt-4 border-t border-border/60">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Active Chart
              </p>
              <div className="p-3 rounded-lg border border-border/60 bg-card/60 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center font-bold text-xs text-foreground overflow-hidden">
                  {selectedPatient.avatar ? (
                    <img src={selectedPatient.avatar} alt={selectedPatient.name} className="h-full w-full object-cover" />
                  ) : (
                    selectedPatient.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold truncate text-foreground">{selectedPatient.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{selectedPatient.norwoodStage}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:block pt-4 border-t border-border/60 text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Densify Medical Network</p>
            <p>License: {doctor.licenseNumber}</p>
            <p className="text-[10px] text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> HIPAA-Compliant Session
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl overflow-y-auto">
          {/* TAB 1: CASELOAD & TRIAGE */}
          {activeTab === "caseload" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">Patient Caseload & Triage</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Monitor treatment adherence, follicular density changes, and respond to consultation requests.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedPatientId(selectedPatient.id)
                      setActiveTab("inspection")
                    }}
                    className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Review Active Chart
                  </Button>
                </div>
              </div>

              {/* Triage Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by patient name, email, or Norwood stage..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs bg-card/60"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={filterSeverity === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterSeverity("all")}
                    className="h-9 text-xs"
                  >
                    All ({patients.length})
                  </Button>
                  <Button
                    variant={filterSeverity === "high" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterSeverity("high")}
                    className="h-9 text-xs"
                  >
                    Low Adherence
                  </Button>
                  <Button
                    variant={filterSeverity === "stable" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterSeverity("stable")}
                    className="h-9 text-xs"
                  >
                    High Responders
                  </Button>
                </div>
              </div>

              {/* Patient Caseload Table */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-xl border border-border/70 bg-card/50 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b border-border/70">
                        <tr>
                          <th className="py-3 px-4">Patient Name</th>
                          <th className="py-3 px-3">Classification</th>
                          <th className="py-3 px-3">Adherence</th>
                          <th className="py-3 px-3">Density Delta</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {filteredPatients.map((p) => {
                          const isSelected = p.id === selectedPatientId
                          return (
                            <tr
                              key={p.id}
                              onClick={() => setSelectedPatientId(p.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected ? "bg-primary/10" : "hover:bg-muted/40"
                              }`}
                            >
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-bold text-[11px] overflow-hidden shrink-0">
                                    {p.avatar ? (
                                      <img src={p.avatar} alt={p.name} className="h-full w-full object-cover" />
                                    ) : (
                                      p.name.slice(0, 2).toUpperCase()
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-foreground">{p.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{p.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-3">
                                <Badge variant="outline" className="text-[10px] font-normal py-0">
                                  {p.norwoodStage}
                                </Badge>
                              </td>
                              <td className="py-3.5 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={`h-full ${
                                        p.adherenceRate >= 90 ? "bg-emerald-500" : "bg-amber-500"
                                      }`}
                                      style={{ width: `${p.adherenceRate}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-[11px] font-semibold">{p.adherenceRate}%</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-3">
                                <span
                                  className={`font-semibold ${
                                    p.densityDelta.startsWith("+") ? "text-emerald-500" : "text-amber-500"
                                  }`}
                                >
                                  {p.densityDelta}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedPatientId(p.id)
                                      setActiveTab("inspection")
                                    }}
                                    className="h-7 px-2 text-[11px] hover:bg-primary/10 hover:text-primary"
                                  >
                                    Inspect
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedPatientId(p.id)
                                      setActiveTab("consultation")
                                    }}
                                    className="h-7 px-2 text-[11px] hover:bg-primary/10 hover:text-primary"
                                  >
                                    Chat
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Patient Quick Summary Rail */}
                <div className="space-y-4">
                  <Card className="border-border/70 bg-card/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Patient Clinical Snapshot</CardTitle>
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                          {selectedPatient.norwoodStage}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">{selectedPatient.name}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-xs">
                      {/* Hair Miniaturization Trend Card */}
                      <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-muted-foreground">Follicular Miniaturization</span>
                          <span className="text-emerald-500 font-bold">-6.4% Miniaturized</span>
                        </div>
                        {/* Mini sparkline visualization */}
                        <div className="h-14 w-full flex items-end gap-1.5 pt-2">
                          {[65, 58, 52, 45, 38, 32].map((val, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className="w-full bg-primary/70 rounded-t-sm transition-all"
                                style={{ height: `${val}%` }}
                              />
                              <span className="text-[8px] text-muted-foreground font-mono">M{idx}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Active Regimen Checklist */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Active Prescriptions
                        </p>
                        <div className="space-y-1">
                          {selectedPatient.activeMedications.map((med, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-1.5 rounded bg-muted/30 text-[11px]">
                              <Pill className="h-3 w-3 text-primary shrink-0" />
                              <span className="truncate">{med}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recent Biomarkers */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                          Extracted Lab Biomarkers
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="p-2 rounded border border-border/50 bg-card">
                            <span className="text-muted-foreground block">DHT</span>
                            <span className="font-bold font-mono text-emerald-500 text-xs">240 pg/mL</span>
                            <span className="text-[9px] text-muted-foreground">↓ 52% suppressed</span>
                          </div>
                          <div className="p-2 rounded border border-border/50 bg-card">
                            <span className="text-muted-foreground block">Ferritin</span>
                            <span className="font-bold font-mono text-emerald-500 text-xs">82 ng/mL</span>
                            <span className="text-[9px] text-muted-foreground">Optimal range</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => setActiveTab("inspection")}
                        className="w-full h-8 text-xs bg-primary text-primary-foreground"
                      >
                        Launch Deep Clinical Review
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLINICAL INSPECTION & SOAP NOTES */}
          {activeTab === "inspection" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Scalp Trichoscopy & Chart Review
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Reviewing patient <span className="font-semibold text-foreground">{selectedPatient.name}</span> ({selectedPatient.norwoodStage})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("consultation")}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Open Consultation Chat
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setPrescribeOpen(true)}
                    className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Pill className="h-3.5 w-3.5" />
                    Prescribe / Modify Protocol
                  </Button>
                </div>
              </div>

              {/* Dual Column: Scalp Visualizer + SOAP Notes */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Scalp Progression Comparison (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <Card className="border-border/70 bg-card/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Eye className="h-4 w-4 text-primary" />
                          Progression Vault: Baseline vs Month 6
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                          +7.8% Follicle Density
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Photo Comparison Display */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <div className="relative aspect-square rounded-lg border border-border/70 bg-muted/30 overflow-hidden group">
                            <img
                              src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&auto=format&fit=crop&q=80"
                              alt="Baseline scalp"
                              className="w-full h-full object-cover filter contrast-125"
                            />
                            <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-white">
                              Baseline (Month 0)
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-mono text-muted-foreground">
                              118 FU/cm²
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground text-center">Crown vertex thinning visible</p>
                        </div>

                        <div className="space-y-1.5">
                          <div className="relative aspect-square rounded-lg border border-primary/50 bg-muted/30 overflow-hidden ring-1 ring-primary/30">
                            <img
                              src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&auto=format&fit=crop&q=80"
                              alt="Month 6 scalp"
                              className="w-full h-full object-cover filter contrast-125"
                            />
                            <div className="absolute top-2 left-2 bg-primary/90 text-primary-foreground backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
                              Month 6 (Current)
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded text-[9px] font-mono text-emerald-400 font-bold">
                              127 FU/cm² (+7.8%)
                            </div>
                          </div>
                          <p className="text-[10px] text-emerald-500 font-medium text-center">Follicle reactivation & thickening</p>
                        </div>
                      </div>

                      {/* Trichoscopy AI Metrics Table */}
                      <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Bedrock AI Trichoscopy Telemetry
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 rounded bg-card/60 border border-border/50">
                            <span className="text-[10px] text-muted-foreground block">Follicular Density</span>
                            <span className="font-bold text-foreground">118 &rarr; 127</span>
                            <span className="text-[9px] text-emerald-500 block font-semibold">+7.8%</span>
                          </div>
                          <div className="p-2 rounded bg-card/60 border border-border/50">
                            <span className="text-[10px] text-muted-foreground block">Shaft Diameter</span>
                            <span className="font-bold text-foreground">64μm &rarr; 68μm</span>
                            <span className="text-[9px] text-emerald-500 block font-semibold">+6.2%</span>
                          </div>
                          <div className="p-2 rounded bg-card/60 border border-border/50">
                            <span className="text-[10px] text-muted-foreground block">Anagen : Telogen</span>
                            <span className="font-bold text-foreground">74:26 &rarr; 86:14</span>
                            <span className="text-[9px] text-emerald-500 block font-semibold">Reversal</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right: SOAP Clinical Notes Editor (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <Card className="border-border/70 bg-card/60">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          Clinician SOAP Chart Note
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Private Medical Record
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        Document formal clinical impressions and follow-up protocol.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Subjective (Patient Reported)
                        </label>
                        <textarea
                          rows={2}
                          value={soap.subjective}
                          onChange={(e) => setSoap(prev => ({ ...prev, subjective: e.target.value }))}
                          className="w-full rounded-md border border-border/70 bg-background/80 p-2 text-xs focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Objective (Exam & AI Metrics)
                        </label>
                        <textarea
                          rows={2}
                          value={soap.objective}
                          onChange={(e) => setSoap(prev => ({ ...prev, objective: e.target.value }))}
                          className="w-full rounded-md border border-border/70 bg-background/80 p-2 text-xs focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Assessment (Diagnosis)
                        </label>
                        <textarea
                          rows={2}
                          value={soap.assessment}
                          onChange={(e) => setSoap(prev => ({ ...prev, assessment: e.target.value }))}
                          className="w-full rounded-md border border-border/70 bg-background/80 p-2 text-xs focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                          Plan (Next Steps & Adjustments)
                        </label>
                        <textarea
                          rows={3}
                          value={soap.plan}
                          onChange={(e) => setSoap(prev => ({ ...prev, plan: e.target.value }))}
                          className="w-full rounded-md border border-border/70 bg-background/80 p-2 text-xs focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>

                      <Button
                        size="sm"
                        onClick={handleSaveSOAP}
                        disabled={isSavingSoap}
                        className="w-full h-8 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {isSavingSoap ? "Saving..." : "Save Chart Note to Medical Record"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LIVE CONSULTATION ROOM */}
          {activeTab === "consultation" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Consultation Room & Tele-Trichology
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Direct communication with <span className="font-semibold text-foreground">{selectedPatient.name}</span>. Attach reports or send protocol recommendations.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPrescribeOpen(true)}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Pill className="h-3.5 w-3.5 text-primary" />
                    Prescribe Protocol Card
                  </Button>
                </div>
              </div>

              {/* Chat Thread Interface */}
              <div className="rounded-xl border border-border/70 bg-card/60 flex flex-col h-[600px] overflow-hidden shadow-sm">
                {/* Chat Top Banner */}
                <div className="p-3 border-b border-border/70 bg-muted/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center font-bold text-xs overflow-hidden">
                      {selectedPatient.avatar ? (
                        <img src={selectedPatient.avatar} alt={selectedPatient.name} className="h-full w-full object-cover" />
                      ) : (
                        selectedPatient.name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        {selectedPatient.name}
                        <Badge variant="outline" className="text-[9px] py-0 px-1 border-border/60">
                          {selectedPatient.norwoodStage}
                        </Badge>
                      </p>
                      <p className="text-[10px] text-emerald-500">Encrypted Consultation Channel</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    Adherence: {selectedPatient.adherenceRate}%
                  </Badge>
                </div>

                {/* Messages Body */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {chatMessages.map((msg) => {
                    const isDoctor = msg.sender === "doctor"
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isDoctor ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-md rounded-xl p-3.5 text-xs space-y-2 ${
                            isDoctor
                              ? "bg-primary text-primary-foreground rounded-br-none"
                              : "bg-muted/70 text-foreground border border-border/60 rounded-bl-none"
                          }`}
                        >
                          <p className="leading-relaxed">{msg.text}</p>

                          {/* Render Embedded Report Card if present */}
                          {msg.isReport && msg.reportData && (
                            <div className="rounded-lg p-3 bg-card text-foreground border border-border/70 space-y-2 text-xs shadow-sm">
                              <div className="flex items-center justify-between font-semibold border-b border-border/50 pb-1.5">
                                <span className="flex items-center gap-1.5 text-primary">
                                  <Sparkles className="h-3.5 w-3.5" />
                                  {msg.reportData.title}
                                </span>
                                <Badge variant="outline" className="text-[9px] text-emerald-500 border-emerald-500/30">
                                  {msg.reportData.status}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div>
                                  <span className="text-muted-foreground block">Density Progress</span>
                                  <span className="font-bold font-mono text-emerald-500">{msg.reportData.densityDelta}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Follicular Count</span>
                                  <span className="font-bold font-mono">{msg.reportData.baselineFU} &rarr; {msg.reportData.currentFU}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Serum DHT</span>
                                  <span className="font-bold font-mono text-emerald-500">{msg.reportData.dht}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block">Ferritin</span>
                                  <span className="font-bold font-mono">{msg.reportData.ferritin}</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Render Embedded Proposal Card if present */}
                          {msg.isProposal && msg.proposalData && (
                            <div className="rounded-lg p-3 bg-card text-foreground border border-primary/50 space-y-2 text-xs shadow-md">
                              <div className="flex items-center justify-between font-semibold border-b border-border/50 pb-1">
                                <span className="flex items-center gap-1.5 text-primary">
                                  <Pill className="h-3.5 w-3.5" />
                                  Clinical Regimen Proposal
                                </span>
                                <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30">
                                  Pending Patient Acceptance
                                </Badge>
                              </div>
                              <div className="text-[11px] space-y-0.5">
                                <p><strong className="text-foreground">{msg.proposalData.name}</strong> - {msg.proposalData.dose}</p>
                                <p className="text-muted-foreground">{msg.proposalData.frequency}</p>
                                {msg.proposalData.notes && (
                                  <p className="text-[10px] text-muted-foreground italic mt-1">{msg.proposalData.notes}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground mt-1 px-1">
                          {msg.time}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Chat Input Bar */}
                <div className="p-3 border-t border-border/70 bg-card flex items-center gap-2">
                  <Input
                    placeholder="Type clinical guidance, dosage notes, or report feedback..."
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    className="h-10 text-xs bg-background"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    className="h-10 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RX PROTOCOL MANAGER */}
          {activeTab === "prescriptions" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    Prescription & Regimen Management
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Issue structured treatment modifications for patient confirmation and tracker synchronization.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setPrescribeOpen(true)}
                  className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Pill className="h-3.5 w-3.5" />
                  Create New Protocol Proposal
                </Button>
              </div>

              {/* Protocol Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border/70 bg-card/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Active Regimen for {selectedPatient.name}</CardTitle>
                    <CardDescription className="text-xs">Medications currently monitored in daily check-ins</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedPatient.activeMedications.map((med, idx) => (
                      <div key={idx} className="p-3 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <Pill className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">{med}</p>
                            <p className="text-[10px] text-muted-foreground">Adherence Rate: {selectedPatient.adherenceRate}%</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/30">
                          Active
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Clinical Protocol Prescribing Guide</CardTitle>
                    <CardDescription className="text-xs">Evidence-based titration algorithms</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2.5 text-xs text-muted-foreground">
                    <div className="p-2.5 rounded border border-border/50 bg-background/50">
                      <span className="font-semibold text-foreground block">5-Alpha Reductase Inhibitors</span>
                      Finasteride 1mg PO QD. If insufficient response after Month 6 with confirmed normal PSA, evaluate Dutasteride 0.5mg transition.
                    </div>
                    <div className="p-2.5 rounded border border-border/50 bg-background/50">
                      <span className="font-semibold text-foreground block">Vasodilators & Growth Stimulants</span>
                      Transition from 5% Topical to Oral Minoxidil 1.25mg &rarr; 2.5mg QD based on cardiovascular tolerance and hypertrichosis screening.
                    </div>
                    <div className="p-2.5 rounded border border-border/50 bg-background/50">
                      <span className="font-semibold text-foreground block">Microenvironment Support</span>
                      Ketoconazole 2% shampoo 3x/week to mitigate sebum DHT concentration and micro-inflammation.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Prescribe / Protocol Modal */}
      <Dialog open={prescribeOpen} onOpenChange={setPrescribeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pill className="h-4 w-4 text-primary" />
              Prescribe Protocol Adjustment
            </DialogTitle>
            <DialogDescription className="text-xs">
              This proposal will be sent directly to <strong className="text-foreground">{selectedPatient.name}</strong>. Once accepted, their daily tracker will automatically update.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-foreground block mb-1">
                Medication / Treatment Name
              </label>
              <Input
                placeholder="e.g. Oral Minoxidil, Finasteride"
                value={newMed.name}
                onChange={(e) => setNewMed(prev => ({ ...prev, name: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  Dosage
                </label>
                <Input
                  placeholder="e.g. 2.5mg, 1mg, 5%"
                  value={newMed.dose}
                  onChange={(e) => setNewMed(prev => ({ ...prev, dose: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-foreground block mb-1">
                  Frequency
                </label>
                <Input
                  placeholder="e.g. Once daily, 3x/week"
                  value={newMed.frequency}
                  onChange={(e) => setNewMed(prev => ({ ...prev, frequency: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-foreground block mb-1">
                Clinical Rationale & Instructions
              </label>
              <textarea
                rows={3}
                placeholder="Add medical rationale for the patient..."
                value={newMed.notes}
                onChange={(e) => setNewMed(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full rounded-md border border-border/70 bg-background p-2 text-xs focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPrescribeOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSendProposal}
              disabled={isSubmittingProposal}
              className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmittingProposal ? "Dispatching..." : "Send Proposal to Patient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
