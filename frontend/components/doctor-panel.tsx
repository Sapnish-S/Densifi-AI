"use client"

import { getPublicApiUrl } from "@/lib/api-url"
import React, { useState, useRef, useEffect } from "react"
import {
  Search,
  Star,
  CheckCircle2,
  Lock,
  MessageSquare,
  Send,
  FileBarChart2,
  Activity,
  User,
  Unlock,
  CalendarCheck,
  ShieldCheck
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Mock Data
const SPECIALISTS = [
  {
    id: "doc-1",
    name: "Dr. E. Butler",
    specialty: "Hair Restoration Specialist",
    rating: 5.0,
    fee: "$150 / consult",
    initials: "EB",
    avatarColor: "bg-muted text-muted-foreground",
  },
  {
    id: "doc-2",
    name: "Dr. L. Mehl",
    specialty: "Dermatologist & Trichologist",
    rating: 4.9,
    fee: "$150 / consult",
    initials: "LM",
    avatarColor: "bg-muted text-muted-foreground",
  },
  {
    id: "doc-3",
    name: "Dr. U. Sitaula",
    specialty: "Scalp Specialist",
    rating: 5.0,
    fee: "$150 / consult",
    initials: "US",
    avatarColor: "bg-muted text-muted-foreground",
  }
]

interface Message {
  id: string
  sender: "user" | "doctor" | "system"
  text: string
  isReportCard?: boolean
  reportData?: any
}

const INITIAL_MESSAGES: Message[] = [
  { id: "msg-1", sender: "doctor", text: "Hello, I saw your consultation request. Could you please forward your latest Bedrock AI density report?" }
]

export function DoctorPanel({ report }: { report?: any }) {
  const { data: session } = authClient.useSession()
  const [activeTab, setActiveTab] = useState<"find" | "messages">("find")
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showForwardModal, setShowForwardModal] = useState(false)

  useEffect(() => {
    if (report) {
      setShowForwardModal(true)
    }
  }, [report])

  // Booked Specialists (Start with doc-1 for the demo)
  const [bookedDoctors, setBookedDoctors] = useState<string[]>(["doc-1"])
  const [bookingLoading, setBookingLoading] = useState<string | null>(null)

  // Vault Access state per doctor
  const [vaultAccess, setVaultAccess] = useState<Record<string, boolean>>({
    "doc-1": false
  })

  // Chat State
  const [activeChatId, setActiveChatId] = useState<string | null>("doc-1")
  const [chats, setChats] = useState<Record<string, Message[]>>({
    "doc-1": INITIAL_MESSAGES,
    "doc-2": [],
    "doc-3": []
  })
  const [typedMessage, setTypedMessage] = useState("")
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chats, activeTab, activeChatId])

  const showToast = (message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleBook = async (docId: string, docName: string) => {
    setBookingLoading(docId)
    try {
      // The session hook may not have resolved yet on a quick click; fetch it rather than
      // booking under a placeholder address (the confirmation email would never arrive).
      const email = session?.user?.email ?? (await authClient.getSession()).data?.user?.email
      if (!email) throw new Error("No signed-in user")
      const baseApiUrl = getPublicApiUrl();
      const apiUrl = baseApiUrl.replace(/\/+$/, "");
      await fetch(`${apiUrl}/api/appointments/book`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          doctor_name: docName,
          date_time: new Date().toISOString().split("T")[0] + " 09:00:00"
        })
      }).catch(() => { })
      await new Promise(r => setTimeout(r, 600)) // smooth transition effect

      // Add to booked list if not already
      if (!bookedDoctors.includes(docId)) {
        setBookedDoctors(prev => [...prev, docId])
      }
      setActiveChatId(docId)
      setActiveTab("messages")
      showToast(`Successfully booked consultation with ${docName}`)
    } catch (e) {
      showToast(`Failed to book.`)
    } finally {
      setBookingLoading(null)
    }
  }

  const handleSendMessage = () => {
    if (!typedMessage.trim() || !activeChatId) return
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: typedMessage
    }
    setChats(prev => ({
      ...prev,
      [activeChatId]: [...(prev[activeChatId] || []), newMsg]
    }))
    setTypedMessage("")
  }

  const handleAttachReport = (targetDocId: string = activeChatId || "") => {
    if (!targetDocId) return
    const newMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: "Report Data",
      isReportCard: true,
      reportData: report
    }
    setChats(prev => ({
      ...prev,
      [targetDocId]: [...(prev[targetDocId] || []), newMsg]
    }))
    showToast("Report securely attached to chat.")
  }

  const handleForwardSelect = (docId: string) => {
    setShowForwardModal(false)
    setActiveChatId(docId)
    setActiveTab("messages")
    handleAttachReport(docId)
  }

  const handleToggleVaultAccess = (docId: string) => {
    const currentState = vaultAccess[docId] || false
    const newState = !currentState

    setVaultAccess(prev => ({ ...prev, [docId]: newState }))

    // Drop system message in chat
    const sysMsg: Message = {
      id: Date.now().toString(),
      sender: "system",
      text: newState
        ? "You granted this specialist access to your encrypted Progression Vault."
        : "You revoked this specialist's access to your Progression Vault."
    }

    setChats(prev => ({
      ...prev,
      [docId]: [...(prev[docId] || []), sysMsg]
    }))

    showToast(newState ? "Clinical Access Granted" : "Clinical Access Revoked")
  }

  const activeChatMessages = activeChatId ? (chats[activeChatId] || []) : []
  const activeDoctor = SPECIALISTS.find(d => d.id === activeChatId)

  return (
    <div className="w-full font-sans bg-background min-h-[600px] border border-border rounded-xl shadow-sm overflow-hidden flex flex-col relative h-[800px] max-h-[90vh]">

      {/* Toast Notification overlay */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-foreground text-background px-5 py-3 rounded-lg shadow-xl animate-in slide-in-from-top-4 fade-in duration-300">
          <CheckCircle2 className="h-5 w-5 text-background" />
          <p className="text-sm font-medium">{toastMessage}</p>
        </div>
      )}

      {/* Forward Report Modal */}
      <Dialog open={showForwardModal} onOpenChange={setShowForwardModal}>
        <DialogContent className="sm:max-w-md bg-background border-border">
          <DialogHeader>
            <DialogTitle>Forward AI Report</DialogTitle>
            <DialogDescription>
              Select a specialist to receive your latest Bedrock AI density report.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {bookedDoctors.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                You haven't booked any specialists yet. Find one in the directory first.
              </div>
            ) : (
              bookedDoctors.map(docId => {
                const doc = SPECIALISTS.find(d => d.id === docId)
                if (!doc) return null
                return (
                  <Button
                    key={doc.id}
                    variant="outline"
                    className="w-full justify-start h-auto p-4 border-border hover:bg-muted/50"
                    onClick={() => handleForwardSelect(doc.id)}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${doc.avatarColor} mr-3`}>
                      {doc.initials}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.specialty}</p>
                    </div>
                  </Button>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Header / Navigation */}
      <div className="flex border-b border-border bg-muted/30 shrink-0">
        <button
          onClick={() => setActiveTab("find")}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors ${activeTab === "find"
              ? "text-foreground border-b-2 border-primary bg-background"
              : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
            }`}
        >
          <Search className="h-4 w-4" />
          Find a Specialist
        </button>
        <button
          onClick={() => setActiveTab("messages")}
          className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-colors ${activeTab === "messages"
              ? "text-foreground border-b-2 border-primary bg-background"
              : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
            }`}
        >
          <MessageSquare className="h-4 w-4" />
          Messages
          {bookedDoctors.length > 0 && (
            <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {bookedDoctors.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-background overflow-hidden relative">

        {/* VIEW A: FIND A SPECIALIST (DIRECTORY ONLY) */}
        {activeTab === "find" && (
          <div className="h-full overflow-y-auto p-6 md:p-8 space-y-6 animate-in fade-in duration-300">

            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground tracking-tight">Specialist Directory</h2>
              <p className="text-sm text-muted-foreground">Connect with top-tier hair restoration professionals to review your AI metrics.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {SPECIALISTS.map(doc => {
                const isBooked = bookedDoctors.includes(doc.id)
                const isLoading = bookingLoading === doc.id

                return (
                  <Card key={doc.id} className="bg-card border-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                    {isBooked && (
                      <div className="absolute top-3 right-3">
                        <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-muted-foreground bg-muted px-2 py-1 rounded-md">
                          <CheckCircle2 className="h-3 w-3" /> Booked
                        </span>
                      </div>
                    )}
                    <CardContent className="p-6 text-center flex flex-col items-center">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-4 ${doc.avatarColor}`}>
                        {doc.initials}
                      </div>
                      <h3 className="font-semibold text-foreground text-base">{doc.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1 h-4">{doc.specialty}</p>

                      <div className="flex items-center gap-1 mt-4 mb-5">
                        <Star className="h-4 w-4 fill-primary text-primary" />
                        <span className="text-sm font-semibold text-foreground">{doc.rating.toFixed(1)}</span>
                      </div>

                      <div className="w-full space-y-3 mt-auto pt-4 border-t border-border">
                        <div className="text-sm font-medium text-foreground">{doc.fee}</div>
                        <Button
                          onClick={() => isBooked ? (setActiveChatId(doc.id), setActiveTab("messages")) : handleBook(doc.id, doc.name)}
                          disabled={isLoading}
                          variant={isBooked ? "outline" : "default"}
                          className={`w-full h-10 rounded-lg shadow-sm font-medium`}
                        >
                          {isLoading ? (
                            <span className="animate-pulse">Booking...</span>
                          ) : isBooked ? (
                            "Message Doctor"
                          ) : (
                            "Book Consultation"
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* VIEW B: CONSULTATION CHAT ROOM */}
        {activeTab === "messages" && (
          <div className="flex h-full animate-in fade-in duration-300">

            {/* Left Pane: Consultations List */}
            <div className="hidden md:flex w-1/3 border-r border-border bg-muted/30 flex-col">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Active Consultations</h3>
              </div>
              <div className="overflow-y-auto flex-1">
                {bookedDoctors.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    <User className="h-8 w-8 mx-auto mb-3 opacity-20" />
                    No active consultations yet.
                  </div>
                ) : (
                  bookedDoctors.map(docId => {
                    const doc = SPECIALISTS.find(d => d.id === docId)
                    if (!doc) return null
                    return (
                      <button
                        key={doc.id}
                        onClick={() => setActiveChatId(doc.id)}
                        className={`w-full text-left p-4 flex items-center gap-3 transition-colors border-l-2 ${activeChatId === doc.id
                            ? "bg-background border-primary shadow-sm"
                            : "border-transparent hover:bg-muted/50"
                          }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${doc.avatarColor}`}>
                          {doc.initials}
                        </div>
                        <div className="overflow-hidden flex-1">
                          <p className="font-medium text-foreground text-sm truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {chats[doc.id]?.length > 0 ? "Tap to view conversation..." : "Start a new conversation"}
                          </p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Right Pane: Chat Interface */}
            <div className="flex-1 flex flex-col bg-background overflow-hidden">
              {!activeChatId || bookedDoctors.length === 0 ? (
                // EMPTY STATE
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6 border border-border">
                    <CalendarCheck className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2 tracking-tight">No active consultation</h3>
                  <p className="text-muted-foreground text-sm max-w-[260px] leading-relaxed mb-6">
                    Head over to the directory to find a specialist and start your clinical review.
                  </p>
                  <Button onClick={() => setActiveTab("find")} className="px-6 h-10 rounded-lg">
                    Find a Specialist
                  </Button>
                </div>
              ) : (
                // CHAT ACTIVE STATE
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-border flex items-center justify-between bg-background shrink-0 shadow-sm z-10">
                    <div className="flex items-center gap-3">
                      <div className="md:hidden flex items-center mr-1">
                        <select
                          value={activeChatId}
                          onChange={(e) => setActiveChatId(e.target.value)}
                          className="bg-background border border-border text-foreground text-sm rounded-md p-1.5 focus:ring-primary focus:border-primary"
                        >
                          {bookedDoctors.map(docId => {
                            const d = SPECIALISTS.find(x => x.id === docId)
                            return d ? <option key={d.id} value={d.id}>{d.name}</option> : null
                          })}
                        </select>
                      </div>
                      <div className={`hidden md:flex w-10 h-10 rounded-full items-center justify-center text-sm font-bold ${activeDoctor?.avatarColor}`}>
                        {activeDoctor?.initials}
                      </div>
                      <div className="hidden md:block">
                        <h3 className="font-semibold text-foreground leading-none mb-1">{activeDoctor?.name}</h3>
                        <p className="text-xs text-muted-foreground leading-none">{activeDoctor?.specialty}</p>
                      </div>
                    </div>

                    {/* Patient-Provider Action Bar */}
                    <div className="flex items-center gap-3">
                      <div className="hidden lg:flex items-center gap-2 mr-2 border-r border-border pr-5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vault Access</span>
                        <button
                          role="switch"
                          aria-checked={vaultAccess[activeChatId]}
                          onClick={() => handleToggleVaultAccess(activeChatId)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${vaultAccess[activeChatId] ? 'bg-primary' : 'bg-muted'}`}
                        >
                          <span
                            className={`pointer-events-none block h-3.5 w-3.5 rounded-full bg-background shadow-sm ring-0 transition-transform ${vaultAccess[activeChatId] ? 'translate-x-4' : 'translate-x-0'}`}
                          />
                        </button>
                      </div>

                      <Button
                        onClick={() => handleToggleVaultAccess(activeChatId)}
                        variant={vaultAccess[activeChatId] ? "default" : "outline"}
                        size="sm"
                        className={`h-8 text-xs lg:hidden`}
                      >
                        {vaultAccess[activeChatId] ? <Unlock className="h-3 w-3 mr-1" /> : <Lock className="h-3 w-3 mr-1" />}
                        {vaultAccess[activeChatId] ? "Vault Open" : "Vault Locked"}
                      </Button>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-muted/20">
                    {activeChatMessages.map((msg, index) => (
                      <div key={msg.id || index} className={`flex ${msg.sender === 'user' ? 'justify-end' : msg.sender === 'system' ? 'justify-center' : 'justify-start'}`}>

                        {msg.isReportCard ? (
                          <div className="bg-card border border-border p-4 rounded-xl shadow-sm w-full max-w-[280px]">
                            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                              <Activity className="h-4 w-4 text-foreground" />
                              <span className="font-semibold text-xs text-foreground">Bedrock AI Report</span>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Density</span>
                                <span className="text-sm font-bold text-foreground">
                                  {msg.reportData?.density_percentage ? `${msg.reportData.density_percentage.toFixed(1)}%` : '30%'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Miniaturization</span>
                                <span className="text-sm font-bold text-foreground">
                                  {msg.reportData?.miniaturization_index !== undefined ? msg.reportData.miniaturization_index.toFixed(2) : '0.7'}
                                </span>
                              </div>
                              {msg.reportData?.clinical_summary && (
                                <div className="mt-2 pt-3 border-t border-border">
                                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Clinical Summary</span>
                                  <p className="text-xs text-foreground leading-relaxed">
                                    {msg.reportData.clinical_summary}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : msg.sender === 'system' ? (
                          <div className="bg-muted border border-border px-4 py-2 rounded-full flex items-center gap-2 shadow-sm my-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-medium text-muted-foreground tracking-wide">{msg.text}</span>
                          </div>
                        ) : (
                          <div className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl text-sm leading-relaxed ${msg.sender === 'user'
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-muted text-foreground rounded-bl-sm border border-border'
                            }`}>
                            {msg.text}
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input */}
                  <div className="p-4 border-t border-border bg-background shrink-0">
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleAttachReport(activeChatId || "")}
                        variant="outline"
                        className="shrink-0 h-12 px-4 rounded-lg border-border text-muted-foreground font-medium hidden md:flex"
                      >
                        <FileBarChart2 className="h-4 w-4 mr-2" />
                        Attach Report
                      </Button>
                      <Button
                        onClick={() => handleAttachReport(activeChatId || "")}
                        variant="outline"
                        size="icon"
                        className="shrink-0 h-12 w-12 rounded-lg border-border text-muted-foreground md:hidden"
                      >
                        <FileBarChart2 className="h-5 w-5" />
                      </Button>

                      <div className="flex-1 relative flex items-center">
                        <Input
                          value={typedMessage}
                          onChange={(e) => setTypedMessage(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          placeholder="Type a message..."
                          className="flex-1 h-12 bg-muted text-foreground border-border rounded-lg pr-12 focus-visible:ring-1 focus-visible:ring-primary"
                        />
                        <Button
                          size="icon"
                          onClick={handleSendMessage}
                          className="absolute right-1.5 h-9 w-9 rounded-md transition-colors"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
