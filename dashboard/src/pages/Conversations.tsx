import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface ConversationsProps {
  practiceId: string
}

interface Patient {
  id: string
  first_name: string | null
  last_name: string | null
  phone: string
  status: string
}

interface Message {
  id: string
  practice_id: string
  patient_id: string
  direction: 'inbound' | 'outbound'
  message_body: string
  created_at: string
  ai_generated: boolean
  channel: string | null
}

function patientDisplayName(p: Patient): string {
  const parts = [p.first_name, p.last_name].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : p.phone || 'Unknown'
}

interface ConversationPreview {
  patient: Patient
  lastMessage: string
  lastMessageTime: string
  unread: boolean
}

function getStatusBadgeStyle(status: string): { background: string; color: string } {
  switch (status) {
    case 'booked': return { background: 'var(--accent-dim)', color: 'var(--accent)' }
    case 'new': return { background: 'var(--blue-dim)', color: 'var(--blue)' }
    case 'nurturing': return { background: 'var(--amber-dim)', color: 'var(--amber)' }
    default: return { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }
  }
}

function getAvatarStyle(status: string): { background: string; color: string } {
  switch (status) {
    case 'booked': return { background: 'var(--accent-dim)', color: 'var(--accent)' }
    case 'new': return { background: 'var(--blue-dim)', color: 'var(--blue)' }
    case 'nurturing': return { background: 'var(--amber-dim)', color: 'var(--amber)' }
    default: return { background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }
  }
}

function Conversations({ practiceId }: ConversationsProps) {
  const [searchParams] = useSearchParams()
  const initialPatientId = searchParams.get('patient')

  const [patients, setPatients] = useState<Patient[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(initialPatientId)
  const [previews, setPreviews] = useState<Map<string, ConversationPreview>>(new Map())
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!practiceId) return

    async function fetchPatients() {
      setLoadingPatients(true)

      const [{ data: patientData, error }, { data: convData }] = await Promise.all([
        supabase
          .from('patients')
          .select('id, first_name, last_name, phone, status')
          .eq('practice_id', practiceId)
          .order('created_at', { ascending: false }),
        supabase
          .from('conversation_previews')
          .select('patient_id, message_body, created_at')
          .eq('practice_id', practiceId)
          .order('created_at', { ascending: false }),
      ])

      if (!error && patientData) {
        setPatients(patientData as Patient[])

        // Build preview map: first occurrence per patient_id is the most recent (already sorted desc)
        const previewMap = new Map<string, ConversationPreview>()
        const patientMap = new Map((patientData as Patient[]).map((p) => [p.id, p]))

        if (convData) {
          for (const msg of convData) {
            if (!previewMap.has(msg.patient_id)) {
              const patient = patientMap.get(msg.patient_id)
              if (patient) {
                previewMap.set(msg.patient_id, {
                  patient,
                  lastMessage: msg.message_body,
                  lastMessageTime: msg.created_at,
                  unread: false,
                })
              }
            }
          }
        }
        setPreviews(previewMap)
      }
      setLoadingPatients(false)
    }

    fetchPatients()
  }, [practiceId])

  useEffect(() => {
    if (!practiceId || !selectedPatientId) {
      setMessages([])
      return
    }

    async function fetchMessages() {
      setLoadingMessages(true)
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('patient_id', selectedPatientId)
        .order('created_at', { ascending: true })

      if (!error && data) {
        setMessages(data as Message[])
      }
      setLoadingMessages(false)
    }

    fetchMessages()

    const channel = supabase
      .channel(`conversations_${selectedPatientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `patient_id=eq.${selectedPatientId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          if (newMsg.practice_id === practiceId) {
            setMessages((prev) => [...prev, newMsg])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [practiceId, selectedPatientId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const filteredPatients = useMemo(() => {
    // Only show patients who have at least one conversation
    const withConversations = patients.filter((p) => previews.has(p.id))
    if (!searchQuery.trim()) return withConversations
    const query = searchQuery.toLowerCase()
    return withConversations.filter(
      (p) =>
        patientDisplayName(p).toLowerCase().includes(query) ||
        p.phone?.includes(query)
    )
  }, [patients, searchQuery, previews])

  const sortedPatients = useMemo(() => {
    return [...filteredPatients].sort((a, b) => {
      const previewA = previews.get(a.id)
      const previewB = previews.get(b.id)
      if (previewA && previewB) {
        return (
          new Date(previewB.lastMessageTime).getTime() -
          new Date(previewA.lastMessageTime).getTime()
        )
      }
      return 0
    })
  }, [filteredPatients, previews])

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedPatientId || sending) return

    setSending(true)
    try {
      const { error } = await supabase.from('conversations').insert({
        practice_id: practiceId,
        patient_id: selectedPatientId,
        direction: 'outbound',
        message_body: newMessage.trim(),
        ai_generated: false,
        channel: 'sms',
      })

      if (!error) {
        setNewMessage('')
      }
    } catch (err) {
      console.error('Error sending message:', err)
    } finally {
      setSending(false)
    }
  }

  function formatMessageTime(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  function formatPreviewTime(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'now'
    if (diffMins < 60) return `${diffMins}m`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function getChannelIcon(channel: string | null) {
    if (channel === 'sms') return (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )
    return null
  }

  return (
    <div className="flex h-full">
      {/* Left panel: patient list */}
      <div
        className="flex flex-col"
        style={{
          width: 320,
          borderRight: '0.5px solid var(--border-default)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        {/* Search */}
        <div style={{ padding: 16, borderBottom: '0.5px solid var(--border-default)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px', fontFamily: "'Outfit', sans-serif" }}>
            Conversations
          </h2>
          <div className="relative">
            <svg
              className="absolute"
              style={{ left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-faint)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: 32,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                background: 'var(--bg-elevated)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontFamily: "'Outfit', sans-serif",
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Patient list */}
        <div className="flex-1 overflow-y-auto">
          {loadingPatients ? (
            <div style={{ padding: 16 }} className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ height: 48, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
              ))}
            </div>
          ) : sortedPatients.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-faint)', fontSize: 13 }}>
              {searchQuery.trim() ? 'No matching conversations' : 'No conversations yet'}
            </div>
          ) : (
            sortedPatients.map((patient) => {
              const preview = previews.get(patient.id)
              const isSelected = patient.id === selectedPatientId
              const avatar = getAvatarStyle(patient.status)

              return (
                <button
                  key={patient.id}
                  onClick={() => setSelectedPatientId(patient.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 16px',
                    borderBottom: '0.5px solid var(--border-default)',
                    background: isSelected ? 'var(--bg-elevated)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    cursor: 'pointer',
                    border: 'none',
                    borderBottomStyle: 'solid' as const,
                    borderBottomWidth: '0.5px',
                    borderBottomColor: 'var(--border-default)',
                    borderLeftStyle: 'solid' as const,
                    borderLeftWidth: isSelected ? '3px' : '3px',
                    borderLeftColor: isSelected ? 'var(--accent)' : 'transparent',
                    fontFamily: "'Outfit', sans-serif",
                    display: 'block',
                    backgroundColor: isSelected ? 'var(--bg-elevated)' : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: avatar.background,
                        color: avatar.color,
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {patientDisplayName(patient).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                          {patientDisplayName(patient)}
                        </p>
                        {preview && (
                          <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0, marginLeft: 8 }}>
                            {formatPreviewTime(preview.lastMessageTime)}
                          </span>
                        )}
                      </div>
                      <p className="truncate" style={{ fontSize: 12, color: 'var(--text-faint)', margin: '2px 0 0' }}>
                        {preview ? preview.lastMessage : patient.phone}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right panel: message thread */}
      <div className="flex-1 flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        {selectedPatientId && selectedPatient ? (
          <>
            {/* Header */}
            <div
              className="flex items-center justify-between px-6"
              style={{
                padding: '14px 24px',
                borderBottom: '0.5px solid var(--border-default)',
                background: 'var(--bg-card)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    ...getAvatarStyle(selectedPatient.status),
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {patientDisplayName(selectedPatient).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                    {patientDisplayName(selectedPatient)}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>{selectedPatient.phone}</p>
                </div>
              </div>
              <span
                className="badge"
                style={getStatusBadgeStyle(selectedPatient.status)}
              >
                {selectedPatient.status}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto" style={{ padding: '20px 24px' }}>
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: 'var(--accent)' }} />
                    <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-faint)' }}>Loading messages...</p>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-faint)', fontSize: 13 }}>
                  No messages yet. Start a conversation below.
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex"
                      style={{ justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start' }}
                    >
                      <div
                        style={{
                          maxWidth: '70%',
                          padding: '10px 14px',
                          borderRadius: msg.direction === 'outbound'
                            ? '16px 16px 4px 16px'
                            : '16px 16px 16px 4px',
                          background: msg.direction === 'outbound'
                            ? 'var(--accent-dim)'
                            : 'var(--bg-surface)',
                          border: msg.direction === 'inbound' ? '0.5px solid var(--border-default)' : 'none',
                        }}
                      >
                        <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                          {msg.message_body}
                        </p>
                        <div
                          className="flex items-center gap-2 mt-1"
                          style={{ justifyContent: msg.direction === 'outbound' ? 'flex-end' : 'flex-start' }}
                        >
                          {getChannelIcon(msg.channel)}
                          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                            {formatMessageTime(msg.created_at)}
                          </span>
                          {msg.direction === 'outbound' && msg.ai_generated && (
                            <span
                              className="badge"
                              style={{
                                background: 'var(--accent-dim)',
                                color: 'var(--accent)',
                                fontSize: 9,
                                padding: '1px 6px',
                              }}
                            >
                              AI
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ padding: '14px 24px', borderTop: '0.5px solid var(--border-default)', background: 'var(--bg-card)' }}>
              <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Type a message to send via SMS..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={sending}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: 'var(--bg-elevated)',
                    border: '0.5px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontFamily: "'Outfit', sans-serif",
                    outline: 'none',
                    opacity: sending ? 0.5 : 1,
                  }}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-sm)',
                    background: !newMessage.trim() || sending ? 'var(--bg-elevated)' : 'var(--accent)',
                    color: !newMessage.trim() || sending ? 'var(--text-faint)' : '#0C0F12',
                    border: 'none',
                    cursor: !newMessage.trim() || sending ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: 'var(--text-faint)' }} />
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send
                    </>
                  )}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg style={{ width: 64, height: 64, margin: '0 auto 16px', color: 'var(--text-faint)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-muted)' }}>Select a conversation</p>
              <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 4 }}>Choose a patient from the left to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Conversations
