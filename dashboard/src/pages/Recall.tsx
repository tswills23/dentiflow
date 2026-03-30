import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface RecallProps {
  practiceId: string
}

interface RecallSequence {
  id: string
  practice_id: string
  patient_id: string
  assigned_voice: 'office' | 'hygienist' | 'doctor'
  segment_overdue: string
  sequence_day: number
  sequence_status: 'active' | 'paused' | 'completed' | 'exited'
  booking_stage: string
  reply_count: number
  opt_out: boolean
  defer_until: string | null
  exit_reason: string | null
  last_sent_at: string | null
  link_clicked_at: string | null
  created_at: string
  updated_at: string
}

interface PatientInfo {
  id: string
  first_name: string | null
  last_name: string | null
  location: string | null
}

interface ActivityEvent {
  id: string
  practice_id: string
  patient_id: string | null
  automation_type: string
  action: string | null
  result: string
  message_body: string | null
  service_context: string | null
  metadata: Record<string, unknown>
  created_at: string
  patient_name?: string
  patient_location?: string
}

// Booking stage labels for the funnel
const FUNNEL_STAGES = [
  { key: 'sent', label: 'Sent', description: 'Messages sent' },
  { key: 'clicked', label: 'Clicked', description: 'Clicked booking link' },
  { key: 'replied', label: 'Replied', description: 'Got a reply' },
  { key: 'S6_COMPLETED', label: 'Booked', description: 'Appointment set' },
] as const

// Map booking stages to funnel index (which stages count as "at or past" each funnel step)
const STAGE_FUNNEL_INDEX: Record<string, number> = {
  S0_OPENING: 2,   // They replied at least
  S1_INTENT: 2,
  S3_TIME_PREF: 2,
  S4_AVAILABILITY: 2,
  S5_CONFIRMATION: 2,
  S6_COMPLETED: 3,
  S7_HANDOFF: 6,
}

function Recall({ practiceId }: RecallProps) {
  const [sequences, setSequences] = useState<RecallSequence[]>([])
  const [patients, setPatients] = useState<Map<string, PatientInfo>>(new Map())
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)

  // Filters
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [voiceFilter, setVoiceFilter] = useState<string>('all')
  const [dayFilter, setDayFilter] = useState<string>('all')

  // Fetch all recall sequences
  useEffect(() => {
    if (!practiceId) return

    async function fetchData() {
      setLoading(true)

      // Fetch sequences
      const { data: seqData, error: seqError } = await supabase
        .from('recall_sequences')
        .select('*')
        .eq('practice_id', practiceId)

      if (seqError) {
        console.error('Error fetching sequences:', seqError)
        setLoading(false)
        return
      }

      const seqs = (seqData ?? []) as RecallSequence[]
      setSequences(seqs)

      // Fetch patient info for all patients in sequences
      const patientIds = [...new Set(seqs.map((s) => s.patient_id))]
      if (patientIds.length > 0) {
        // Batch fetch in chunks of 500
        const patientMap = new Map<string, PatientInfo>()
        for (let i = 0; i < patientIds.length; i += 500) {
          const chunk = patientIds.slice(i, i + 500)
          const { data: patData } = await supabase
            .from('patients')
            .select('id, first_name, last_name, location')
            .in('id', chunk)

          if (patData) {
            for (const p of patData as PatientInfo[]) {
              patientMap.set(p.id, p)
            }
          }
        }
        setPatients(patientMap)
      }

      setLoading(false)
    }

    fetchData()

    // Realtime subscription for recall_sequences
    const channel = supabase
      .channel(`recall_sequences_changes_${practiceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recall_sequences',
          filter: `practice_id=eq.${practiceId}`,
        },
        (payload) => {
          setSequences((current) => {
            const newRecord = payload.new as RecallSequence
            const oldRecord = payload.old as RecallSequence & { id: string }

            switch (payload.eventType) {
              case 'INSERT':
                return [newRecord, ...current]
              case 'UPDATE':
                return current.map((item) =>
                  item.id === newRecord.id ? newRecord : item
                )
              case 'DELETE':
                return current.filter((item) => item.id !== oldRecord.id)
              default:
                return current
            }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [practiceId])

  // Fetch activity log (recall-specific)
  useEffect(() => {
    if (!practiceId) return

    async function fetchActivity() {
      setActivityLoading(true)
      const { data, error } = await supabase
        .from('automation_log')
        .select('*')
        .eq('practice_id', practiceId)
        .in('automation_type', ['recall_outreach', 'recall_reply', 'recall_booking', 'recall_opt_out', 'recall_deferred', 'recall_emergency', 'recall_day0', 'recall_day1', 'recall_day3', 'recall_cron', 'recall_link_click', 'recall_link_followup', 'recall_booking_attributed'])
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        // Enrich with patient names
        const events = data as ActivityEvent[]
        const pIds = [...new Set(events.filter((e) => e.patient_id).map((e) => e.patient_id!))]

        if (pIds.length > 0) {
          const { data: patData } = await supabase
            .from('patients')
            .select('id, first_name, last_name, location')
            .in('id', pIds)

          if (patData) {
            const pMap = new Map<string, PatientInfo>()
            for (const p of patData as PatientInfo[]) {
              pMap.set(p.id, p)
            }
            for (const e of events) {
              if (e.patient_id) {
                const pat = pMap.get(e.patient_id)
                if (pat) {
                  e.patient_name = [pat.first_name, pat.last_name].filter(Boolean).join(' ')
                  e.patient_location = pat.location ?? undefined
                }
              }
            }
          }
        }

        setActivityLog(events)
      }
      setActivityLoading(false)
    }

    fetchActivity()

    // Realtime for new activity
    const channel = supabase
      .channel(`recall_activity_${practiceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'automation_log',
          filter: `practice_id=eq.${practiceId}`,
        },
        (payload) => {
          const newEvent = payload.new as ActivityEvent
          // Only include recall events
          if (newEvent.automation_type?.startsWith('recall')) {
            setActivityLog((prev) => [newEvent, ...prev.slice(0, 49)])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [practiceId])

  // Available locations from patient data
  const locations = useMemo(() => {
    const locs = new Set<string>()
    patients.forEach((p) => {
      if (p.location) locs.add(p.location)
    })
    return [...locs].sort()
  }, [patients])

  // Filter sequences by location
  const filteredSequences = useMemo(() => {
    let filtered = sequences

    if (locationFilter !== 'all') {
      const patientIdsAtLocation = new Set<string>()
      patients.forEach((p) => {
        if (p.location === locationFilter) patientIdsAtLocation.add(p.id)
      })
      filtered = filtered.filter((s) => patientIdsAtLocation.has(s.patient_id))
    }

    if (voiceFilter !== 'all') {
      filtered = filtered.filter((s) => s.assigned_voice === voiceFilter)
    }

    return filtered
  }, [sequences, locationFilter, voiceFilter, patients])

  // Campaign overview stats
  const stats = useMemo(() => {
    const total = filteredSequences.length
    const active = filteredSequences.filter((s) =>
      s.sequence_status === 'active' && !['S6_COMPLETED', 'EXIT_OPT_OUT', 'EXIT_DEFERRED', 'EXIT_DECLINED', 'EXIT_CANCELLED'].includes(s.booking_stage)
    ).length
    const booked = filteredSequences.filter((s) => s.booking_stage === 'S6_COMPLETED').length
    const noResponse = filteredSequences.filter((s) =>
      (s.sequence_status === 'completed' || s.sequence_status === 'exited') && s.exit_reason === 'no_response'
    ).length
    const optedOut = filteredSequences.filter((s) =>
      s.booking_stage === 'EXIT_OPT_OUT' || s.opt_out
    ).length
    const deferred = filteredSequences.filter((s) =>
      s.booking_stage === 'EXIT_DEFERRED' || (s.defer_until !== null && s.sequence_status !== 'completed')
    ).length

    const withReplies = filteredSequences.filter((s) => s.reply_count > 0).length
    const withSent = filteredSequences.filter((s) => s.last_sent_at !== null).length
    const responseRate = withSent > 0 ? (withReplies / withSent) * 100 : 0
    const bookingRate = withReplies > 0 ? (booked / withReplies) * 100 : 0

    return { total, active, booked, noResponse, optedOut, deferred, responseRate, bookingRate, withReplies, withSent }
  }, [filteredSequences])

  // Funnel data
  const funnelData = useMemo(() => {
    const sent = filteredSequences.filter((s) => s.last_sent_at !== null).length
    const clicked = filteredSequences.filter((s) => s.link_clicked_at !== null).length
    const replied = filteredSequences.filter((s) => s.reply_count > 0).length
    const booked = filteredSequences.filter((s) => s.booking_stage === 'S6_COMPLETED').length

    return [
      { ...FUNNEL_STAGES[0], count: sent },
      { ...FUNNEL_STAGES[1], count: clicked },
      { ...FUNNEL_STAGES[2], count: replied },
      { ...FUNNEL_STAGES[3], count: booked },
    ]
  }, [filteredSequences])

  // Day progression breakdown
  const dayBreakdown = useMemo(() => {
    const activeSeqs = filteredSequences.filter((s) => s.sequence_status === 'active')
    const day0 = activeSeqs.filter((s) => s.sequence_day === 0).length
    const day1 = activeSeqs.filter((s) => s.sequence_day === 1).length
    const day3 = activeSeqs.filter((s) => s.sequence_day === 3).length
    const autoExited = filteredSequences.filter((s) =>
      (s.sequence_status === 'exited' || s.sequence_status === 'completed') && s.exit_reason === 'no_response'
    ).length
    const deferredPool = filteredSequences.filter((s) =>
      s.defer_until !== null && s.sequence_status !== 'completed'
    ).length

    return { day0, day1, day3, autoExited, deferredPool }
  }, [filteredSequences])

  // Performance by voice tier
  const voicePerformance = useMemo(() => {
    const tiers: Array<'office' | 'hygienist' | 'doctor'> = ['office', 'hygienist', 'doctor']
    return tiers.map((voice) => {
      const voiceSeqs = filteredSequences.filter((s) => s.assigned_voice === voice)
      const total = voiceSeqs.length
      const sent = voiceSeqs.filter((s) => s.last_sent_at !== null).length
      const replied = voiceSeqs.filter((s) => s.reply_count > 0).length
      const booked = voiceSeqs.filter((s) => s.booking_stage === 'S6_COMPLETED').length
      const responseRate = sent > 0 ? (replied / sent) * 100 : 0
      const bookingRate = replied > 0 ? (booked / replied) * 100 : 0
      return { voice, total, sent, replied, booked, responseRate, bookingRate }
    })
  }, [filteredSequences])

  // Performance by day
  const dayPerformance = useMemo(() => {
    // Count sequences that got a reply on each day (approximation: which day they're currently on)
    const days = [0, 1, 3] as const
    return days.map((day) => {
      const daySeqs = filteredSequences.filter((s) => s.sequence_day >= day)
      const sent = daySeqs.length
      const replied = daySeqs.filter((s) => s.reply_count > 0).length
      const responseRate = sent > 0 ? (replied / sent) * 100 : 0
      return { day: `Day ${day}`, sent, replied, responseRate }
    })
  }, [filteredSequences])

  // Filtered activity by location / voice / day
  const filteredActivity = useMemo(() => {
    let events = activityLog

    if (locationFilter !== 'all') {
      events = events.filter((e) => e.patient_location === locationFilter)
    }

    if (dayFilter !== 'all') {
      events = events.filter((e) => {
        const type = e.automation_type
        if (dayFilter === '0') return type === 'recall_day0' || type === 'recall_outreach'
        if (dayFilter === '1') return type === 'recall_day1'
        if (dayFilter === '3') return type === 'recall_day3'
        return true
      })
    }

    return events
  }, [activityLog, locationFilter, dayFilter])

  const timeAgo = useCallback((dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }, [])

  function getEventIcon(type: string): { dot: string; label: string } {
    switch (type) {
      case 'recall_day0':
      case 'recall_outreach':
        return { dot: 'dot-amber', label: 'Day 0 Sent' }
      case 'recall_day1':
        return { dot: 'dot-amber', label: 'Day 1 Sent' }
      case 'recall_day3':
        return { dot: 'dot-amber', label: 'Day 3 Sent' }
      case 'recall_reply':
        return { dot: 'dot-blue', label: 'Reply' }
      case 'recall_booking':
      case 'recall_booking_attributed':
        return { dot: 'dot-accent', label: 'Booked' }
      case 'recall_link_click':
        return { dot: 'dot-blue', label: 'Link Clicked' }
      case 'recall_link_followup':
        return { dot: 'dot-amber', label: 'Follow-up' }
      case 'recall_opt_out':
        return { dot: 'dot-red', label: 'Opted Out' }
      case 'recall_deferred':
        return { dot: 'dot-amber', label: 'Deferred' }
      case 'recall_emergency':
        return { dot: 'dot-red', label: 'Emergency' }
      default:
        return { dot: 'dot-blue', label: 'Reactivation' }
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div className="space-y-6">
          <div className="card" style={{ height: 100, opacity: 0.3 }} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card" style={{ height: 120, opacity: 0.3 }} />
            ))}
          </div>
          <div className="card" style={{ height: 200, opacity: 0.3 }} />
        </div>
      </div>
    )
  }

  const maxFunnelCount = Math.max(funnelData[0].count, 1)

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Page header + filters */}
      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 22, color: 'var(--text-primary)', margin: 0 }}>
            Reactivation Campaign
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {stats.total.toLocaleString()} patients in reactivation sequences
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Location filter */}
          {locations.length > 1 && (
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              style={{
                background: 'var(--bg-card)',
                border: '0.5px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                fontSize: 13,
                color: 'var(--text-primary)',
                fontFamily: "'Outfit', sans-serif",
                cursor: 'pointer',
              }}
            >
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          )}

          {/* Voice filter */}
          <select
            value={voiceFilter}
            onChange={(e) => setVoiceFilter(e.target.value)}
            style={{
              background: 'var(--bg-card)',
              border: '0.5px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: 13,
              color: 'var(--text-primary)',
              fontFamily: "'Outfit', sans-serif",
              cursor: 'pointer',
            }}
          >
            <option value="all">All Voices</option>
            <option value="office">Office</option>
            <option value="hygienist">Hygienist</option>
            <option value="doctor">Doctor</option>
          </select>
        </div>
      </div>

      {/* Section 1: Campaign Overview */}
      <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
        Campaign Overview
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 24 }}>
        <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: '0ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="dot dot-blue" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Active</span>
          </div>
          <p className="font-metric" style={{ fontSize: 32, color: 'var(--blue)', lineHeight: 1, margin: 0 }}>
            {stats.active.toLocaleString()}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>in-progress sequences</p>
        </div>

        <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: '50ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="dot dot-accent" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Booked</span>
          </div>
          <p className="font-metric" style={{ fontSize: 32, color: 'var(--accent)', lineHeight: 1, margin: 0 }}>
            {stats.booked.toLocaleString()}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>appointments from reactivation</p>
        </div>

        <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="dot dot-accent" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Response Rate</span>
          </div>
          <p className="font-metric" style={{ fontSize: 32, color: 'var(--accent)', lineHeight: 1, margin: 0 }}>
            {stats.responseRate.toFixed(1)}%
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>{stats.withReplies.toLocaleString()} of {stats.withSent.toLocaleString()} replied</p>
        </div>

        <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: '150ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="dot dot-accent" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Booking Rate</span>
          </div>
          <p className="font-metric" style={{ fontSize: 32, color: 'var(--accent)', lineHeight: 1, margin: 0 }}>
            {stats.bookingRate.toFixed(1)}%
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>of replies → booked</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 24 }}>
        <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="dot dot-amber" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>No Response</span>
          </div>
          <p className="font-metric" style={{ fontSize: 28, color: 'var(--amber)', lineHeight: 1, margin: 0 }}>
            {stats.noResponse.toLocaleString()}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>auto-exited after Day 3</p>
        </div>

        <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: '250ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="dot dot-red" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Opted Out</span>
          </div>
          <p className="font-metric" style={{ fontSize: 28, color: 'var(--red)', lineHeight: 1, margin: 0 }}>
            {stats.optedOut.toLocaleString()}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>permanent unsubscribe</p>
        </div>

        <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: '300ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="dot dot-blue" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Deferred</span>
          </div>
          <p className="font-metric" style={{ fontSize: 28, color: 'var(--blue)', lineHeight: 1, margin: 0 }}>
            {stats.deferred.toLocaleString()}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>will re-enter in 60 days</p>
        </div>
      </div>

      {/* Section 2: Booking Funnel */}
      <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
        Booking Funnel
      </p>

      <div className="card animate-fade-in" style={{ padding: '1.5rem', marginBottom: 24, animationDelay: '100ms' }}>
        <div className="flex flex-col gap-3">
          {funnelData.map((stage, idx) => {
            const pct = maxFunnelCount > 0 ? (stage.count / maxFunnelCount) * 100 : 0
            const prevCount = idx > 0 ? funnelData[idx - 1].count : stage.count
            const conversionPct = prevCount > 0 ? ((stage.count / prevCount) * 100).toFixed(0) : '—'
            return (
              <div key={stage.key} className="flex items-center gap-4">
                <div style={{ width: 90, flexShrink: 0, textAlign: 'right' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{stage.label}</span>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <div
                    style={{
                      height: 28,
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 6,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.max(pct, 1)}%`,
                        background: idx === funnelData.length - 1
                          ? 'var(--accent)'
                          : `rgba(52, 211, 153, ${0.15 + (0.85 * (funnelData.length - idx)) / funnelData.length})`,
                        borderRadius: 6,
                        transition: 'width 0.6s ease',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 10,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: idx === funnelData.length - 1 ? '#0C0F12' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {stage.count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ width: 50, flexShrink: 0, textAlign: 'right' }}>
                  <span style={{ fontSize: 11, color: idx === 0 ? 'var(--text-faint)' : 'var(--text-muted)', fontWeight: 500 }}>
                    {idx === 0 ? '' : `${conversionPct}%`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 3: Day Progression + Section 5: Performance - side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ marginBottom: 24 }}>
        {/* Day Progression */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
            Day Progression
          </p>
          <div className="card animate-fade-in" style={{ padding: '1.5rem', animationDelay: '150ms' }}>
            <div className="flex flex-col gap-4">
              {[
                { label: 'Day 0', sublabel: 'Waiting for first reply', count: dayBreakdown.day0, dot: 'dot-amber' },
                { label: 'Day 1', sublabel: 'Follow-up sent', count: dayBreakdown.day1, dot: 'dot-amber' },
                { label: 'Day 3', sublabel: 'Final attempt sent', count: dayBreakdown.day3, dot: 'dot-amber' },
                { label: 'Auto-Exited', sublabel: 'No response after Day 3', count: dayBreakdown.autoExited, dot: 'dot-red' },
                { label: 'Deferred', sublabel: 'Will re-enter later', count: dayBreakdown.deferredPool, dot: 'dot-blue' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '0.5px solid var(--border-default)' }}>
                  <div className="flex items-center gap-3">
                    <span className={`dot ${row.dot}`} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{row.label}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: 0 }}>{row.sublabel}</p>
                    </div>
                  </div>
                  <span className="font-metric" style={{ fontSize: 24, color: 'var(--text-primary)' }}>
                    {row.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance by Voice Tier */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
            Performance by Voice
          </p>
          <div className="card animate-fade-in" style={{ padding: '1.5rem', animationDelay: '200ms' }}>
            <div className="flex flex-col gap-4">
              {voicePerformance.map((v) => (
                <div key={v.voice} style={{ padding: '8px 0', borderBottom: '0.5px solid var(--border-default)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                      {v.voice}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                      {v.total.toLocaleString()} patients
                    </span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Response</span>
                      <p className="font-metric" style={{ fontSize: 20, color: 'var(--accent)', margin: '2px 0 0' }}>
                        {v.responseRate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Booking</span>
                      <p className="font-metric" style={{ fontSize: 20, color: 'var(--accent)', margin: '2px 0 0' }}>
                        {v.bookingRate.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Booked</span>
                      <p className="font-metric" style={{ fontSize: 20, color: 'var(--blue)', margin: '2px 0 0' }}>
                        {v.booked}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Activity Feed */}
      <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
        Activity Feed
      </p>

      <div className="flex items-center gap-2 mb-3">
        <select
          value={dayFilter}
          onChange={(e) => setDayFilter(e.target.value)}
          style={{
            background: 'var(--bg-card)',
            border: '0.5px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            fontSize: 12,
            color: 'var(--text-primary)',
            fontFamily: "'Outfit', sans-serif",
            cursor: 'pointer',
          }}
        >
          <option value="all">All Days</option>
          <option value="0">Day 0</option>
          <option value="1">Day 1</option>
          <option value="3">Day 3</option>
        </select>
      </div>

      <div className="card animate-fade-in" style={{ padding: '1.5rem', animationDelay: '250ms' }}>
        {activityLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} style={{ height: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }} />
            ))}
          </div>
        ) : filteredActivity.length > 0 ? (
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {filteredActivity.map((entry, idx) => {
              const { dot, label } = getEventIcon(entry.automation_type)
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3"
                  style={{
                    padding: '10px 0',
                    borderBottom: idx < filteredActivity.length - 1 ? '0.5px solid var(--border-default)' : 'none',
                  }}
                >
                  <span className={`dot ${dot}`} style={{ marginTop: 5 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge badge-${dot.replace('dot-', '')}`}>{label}</span>
                      {entry.patient_name && (
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                          {entry.patient_name}
                        </span>
                      )}
                      {entry.patient_location && (
                        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                          {entry.patient_location}
                        </span>
                      )}
                    </div>
                    {entry.message_body && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>
                        {entry.message_body.length > 120
                          ? entry.message_body.substring(0, 120) + '...'
                          : entry.message_body}
                      </p>
                    )}
                    {entry.action && !entry.message_body && (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                        {entry.action}
                      </p>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {timeAgo(entry.created_at)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center" style={{ height: 160, color: 'var(--text-faint)', fontSize: 13 }}>
            No reactivation activity yet
          </div>
        )}
      </div>
    </div>
  )
}

export default Recall
