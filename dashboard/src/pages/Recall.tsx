import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useDashboardSettings } from '../hooks/useDashboardSettings'

interface RecallProps {
  practiceId: string
}

interface RecallSequence {
  id: string
  practice_id: string
  patient_id: string
  sequence_status: 'active' | 'paused' | 'completed' | 'exited'
  booking_stage: string
  reply_count: number
  opt_out: boolean
  last_sent_at: string | null
  link_clicked_at: string | null
  created_at: string
}

interface PatientInfo {
  id: string
  location: string | null
}

function Recall({ practiceId }: RecallProps) {
  const [sequences, setSequences] = useState<RecallSequence[]>([])
  const [patients, setPatients] = useState<Map<string, PatientInfo>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [campaignStartDate, setCampaignStartDate] = useState<string>(() => {
    return localStorage.getItem('recall_campaign_start') ?? ''
  })

  const { settings, save: saveSettings } = useDashboardSettings(practiceId)

  // Settings editor (verified Dentrix bookings + avg patient value)
  const [editingSettings, setEditingSettings] = useState(false)
  const [verifiedInput, setVerifiedInput] = useState('')
  const [asOfInput, setAsOfInput] = useState('')
  const [valueInput, setValueInput] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  function openSettingsEditor() {
    setVerifiedInput(settings.verified_bookings != null ? String(settings.verified_bookings) : '')
    setAsOfInput(settings.verified_as_of ?? '')
    setValueInput(settings.avg_patient_value != null ? String(settings.avg_patient_value) : '')
    setEditingSettings(true)
  }

  async function handleSaveSettings() {
    setSavingSettings(true)
    await saveSettings({
      verified_bookings: verifiedInput.trim() === '' ? undefined : Number(verifiedInput),
      verified_as_of: asOfInput.trim() === '' ? undefined : asOfInput,
      avg_patient_value: valueInput.trim() === '' ? undefined : Number(valueInput),
    })
    setSavingSettings(false)
    setEditingSettings(false)
  }

  // Fetch all recall sequences (+ patient locations for the location filter)
  useEffect(() => {
    if (!practiceId) return

    async function fetchData() {
      setLoading(true)
      setError(null)

      const allSeqs: RecallSequence[] = []
      const PAGE_SIZE = 1000
      let from = 0
      while (true) {
        const { data: seqData, error: seqError } = await supabase
          .from('recall_sequences')
          .select('id, practice_id, patient_id, sequence_status, booking_stage, reply_count, opt_out, last_sent_at, link_clicked_at, created_at')
          .eq('practice_id', practiceId)
          .range(from, from + PAGE_SIZE - 1)

        if (seqError) {
          setError('Could not load reactivation data. Please retry.')
          setLoading(false)
          return
        }

        const page = (seqData ?? []) as RecallSequence[]
        allSeqs.push(...page)
        if (page.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }

      setSequences(allSeqs)

      const patientIds = [...new Set(allSeqs.map((s) => s.patient_id))]
      if (patientIds.length > 0) {
        const patientMap = new Map<string, PatientInfo>()
        for (let i = 0; i < patientIds.length; i += 500) {
          const chunk = patientIds.slice(i, i + 500)
          const { data: patData } = await supabase
            .from('patients')
            .select('id, location')
            .in('id', chunk)
          if (patData) {
            for (const p of patData as PatientInfo[]) patientMap.set(p.id, p)
          }
        }
        setPatients(patientMap)
      }

      setLoading(false)
    }

    fetchData()

    // Realtime: keep live booking/reply counts current.
    const channel = supabase
      .channel(`recall_sequences_changes_${practiceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recall_sequences', filter: `practice_id=eq.${practiceId}` },
        (payload) => {
          setSequences((current) => {
            const newRecord = payload.new as RecallSequence
            const oldRecord = payload.old as RecallSequence & { id: string }
            switch (payload.eventType) {
              case 'INSERT':
                return [newRecord, ...current]
              case 'UPDATE':
                return current.map((item) => (item.id === newRecord.id ? newRecord : item))
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

  const locations = useMemo(() => {
    const locs = new Set<string>()
    patients.forEach((p) => {
      if (p.location) locs.add(p.location)
    })
    return [...locs].sort()
  }, [patients])

  // Filter by campaign-start (via last_sent_at — sequences are reused across rounds)
  // and location.
  const filteredSequences = useMemo(() => {
    let filtered = sequences

    if (campaignStartDate) {
      const start = new Date(campaignStartDate).getTime()
      filtered = filtered.filter(
        (s) => s.last_sent_at !== null && new Date(s.last_sent_at).getTime() >= start
      )
    }

    if (locationFilter !== 'all') {
      const idsAtLocation = new Set<string>()
      patients.forEach((p) => {
        if (p.location === locationFilter) idsAtLocation.add(p.id)
      })
      filtered = filtered.filter((s) => idsAtLocation.has(s.patient_id))
    }

    return filtered
  }, [sequences, locationFilter, patients, campaignStartDate])

  // KPIs — deduped by patient (household dups + multi-round rows exist).
  const stats = useMemo(() => {
    const contacted = new Set<string>()
    const replied = new Set<string>()
    const clicked = new Set<string>()
    const booked = new Set<string>()

    for (const s of filteredSequences) {
      if (s.last_sent_at !== null) contacted.add(s.patient_id)
      if (s.reply_count > 0) replied.add(s.patient_id)
      if (s.link_clicked_at !== null) clicked.add(s.patient_id)
      if (s.booking_stage === 'S6_COMPLETED') booked.add(s.patient_id)
    }

    return {
      contacted: contacted.size,
      replied: replied.size,
      clicked: clicked.size,
      bookedLive: booked.size,
    }
  }, [filteredSequences])

  // Funnel — every stage measured as a share of Contacted, so a stage that
  // isn't strictly downstream (clicking a link without replying) can't exceed 100%.
  const funnelData = useMemo(() => {
    return [
      { key: 'contacted', label: 'Contacted', count: stats.contacted },
      { key: 'replied', label: 'Replied', count: stats.replied },
      { key: 'clicked', label: 'Clicked Link', count: stats.clicked },
      { key: 'booked', label: 'Booked', count: stats.bookedLive },
    ]
  }, [stats])

  const verifiedBookings = settings.verified_bookings ?? null
  const avgValue = settings.avg_patient_value ?? null

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

  if (error) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--red)', fontSize: 14, margin: '0 0 12px' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '8px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#0C0F12', border: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500 }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const maxFunnelCount = Math.max(stats.contacted, 1)
  const selectStyle = {
    background: 'var(--bg-card)',
    border: '0.5px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    fontSize: 13,
    color: 'var(--text-primary)',
    fontFamily: "'Outfit', sans-serif",
    cursor: 'pointer',
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header + filters */}
      <div className="flex items-center justify-between flex-wrap gap-4" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 22, color: 'var(--text-primary)', margin: 0 }}>
            Reactivation Campaign
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            {stats.contacted.toLocaleString()} patients contacted
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {locations.length > 1 && (
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} style={selectStyle}>
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Outfit', sans-serif", whiteSpace: 'nowrap' }}>From</label>
            <input
              type="date"
              value={campaignStartDate}
              onChange={(e) => {
                setCampaignStartDate(e.target.value)
                if (e.target.value) localStorage.setItem('recall_campaign_start', e.target.value)
                else localStorage.removeItem('recall_campaign_start')
              }}
              style={{ ...selectStyle, color: campaignStartDate ? 'var(--text-primary)' : 'var(--text-faint)', colorScheme: 'dark', padding: '6px 10px' }}
            />
          </div>
        </div>
      </div>

      {/* Stale-filter banner */}
      {campaignStartDate && (
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 24, padding: '8px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--amber-dim)', color: 'var(--amber)', fontSize: 12, fontFamily: "'Outfit', sans-serif" }}
        >
          <span>Showing activity since {new Date(campaignStartDate).toLocaleDateString()} — numbers are filtered.</span>
          <button
            onClick={() => {
              setCampaignStartDate('')
              localStorage.removeItem('recall_campaign_start')
            }}
            style={{ background: 'none', border: 'none', color: 'var(--amber)', cursor: 'pointer', fontWeight: 600, fontFamily: "'Outfit', sans-serif", fontSize: 12 }}
          >
            Clear
          </button>
        </div>
      )}

      {/* KPI row */}
      <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: campaignStartDate ? '0 0 12px' : '8px 0 12px' }}>
        Campaign Overview
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 24 }}>
        <KpiCard dot="dot-amber" color="var(--amber)" label="Patients Contacted" value={stats.contacted} sub="unique patients reached" />
        <KpiCard dot="dot-blue" color="var(--blue)" label="Replied" value={stats.replied} sub={stats.contacted > 0 ? `${((stats.replied / stats.contacted) * 100).toFixed(0)}% reply rate` : 'reply rate'} />
        <KpiCard dot="dot-blue" color="var(--blue)" label="Clicked Booking Link" value={stats.clicked} sub={stats.contacted > 0 ? `${((stats.clicked / stats.contacted) * 100).toFixed(0)}% of contacted` : 'of contacted'} />
      </div>

      {/* Bookings — live + manually verified */}
      <div className="flex items-center justify-between" style={{ margin: '0 0 12px' }}>
        <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: 0 }}>
          Bookings
        </p>
        {!editingSettings && (
          <button
            onClick={openSettingsEditor}
            style={{ background: 'none', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: "'Outfit', sans-serif", padding: '4px 10px' }}
          >
            Edit verified figure
          </button>
        )}
      </div>

      {editingSettings ? (
        <div className="card" style={{ padding: '1.5rem', marginBottom: 24 }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 16 }}>
            <LabeledInput label="Verified bookings (Dentrix)" type="number" value={verifiedInput} onChange={setVerifiedInput} placeholder="e.g. 32" />
            <LabeledInput label="Verified as of" type="date" value={asOfInput} onChange={setAsOfInput} />
            <LabeledInput label="Avg patient value ($)" type="number" value={valueInput} onChange={setValueInput} placeholder="e.g. 300" />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: '#0C0F12', border: 'none', cursor: savingSettings ? 'not-allowed' : 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 500, opacity: savingSettings ? 0.6 : 1 }}
            >
              {savingSettings ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditingSettings(false)}
              style={{ padding: '8px 18px', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-muted)', border: '0.5px solid var(--border-default)', cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontSize: 13 }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ marginBottom: 24 }}>
          <KpiCard dot="dot-accent" color="var(--accent)" label="Booked (live)" value={stats.bookedLive} sub="confirmed in-system" />
          <KpiCard
            dot="dot-accent"
            color="var(--accent)"
            label="Verified via Dentrix"
            value={verifiedBookings ?? 0}
            sub={verifiedBookings == null ? 'not set — click edit' : settings.verified_as_of ? `as of ${new Date(settings.verified_as_of).toLocaleDateString()}` : 'manually verified'}
          />
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="dot dot-accent" />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Revenue Recovered</span>
            </div>
            <p className="font-metric" style={{ fontSize: 32, color: 'var(--accent)', lineHeight: 1, margin: 0 }}>
              {avgValue != null && avgValue > 0
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format((stats.bookedLive + (verifiedBookings ?? 0)) * avgValue)
                : '—'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
              {avgValue != null && avgValue > 0 ? `${stats.bookedLive + (verifiedBookings ?? 0)} booked × $${avgValue}` : 'set avg patient value'}
            </p>
          </div>
        </div>
      )}

      {/* Funnel */}
      <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
        Booking Funnel
      </p>
      <div className="card animate-fade-in" style={{ padding: '1.5rem' }}>
        <div className="flex flex-col gap-3">
          {funnelData.map((stage, idx) => {
            const pct = maxFunnelCount > 0 ? (stage.count / maxFunnelCount) * 100 : 0
            const shareOfContacted = stats.contacted > 0 ? ((stage.count / stats.contacted) * 100).toFixed(0) : '—'
            return (
              <div key={stage.key} className="flex items-center gap-4">
                <div style={{ width: 100, flexShrink: 0, textAlign: 'right' }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{stage.label}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 28, background: 'rgba(255,255,255,0.03)', borderRadius: 6, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.max(pct, 1)}%`,
                        background: idx === funnelData.length - 1 ? 'var(--accent)' : `rgba(52, 211, 153, ${0.2 + (0.6 * (funnelData.length - idx)) / funnelData.length})`,
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
                    {idx === 0 ? '' : `${shareOfContacted}%`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '14px 0 0' }}>
          Percentages are share of patients contacted.
        </p>
      </div>
    </div>
  )
}

function KpiCard({ dot, color, label, value, sub }: { dot: string; color: string; label: string; value: number; sub: string }) {
  return (
    <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`dot ${dot}`} />
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p className="font-metric" style={{ fontSize: 32, color, lineHeight: 1, margin: 0 }}>
        {value.toLocaleString()}
      </p>
      <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>{sub}</p>
    </div>
  )
}

function LabeledInput({ label, type, value, onChange, placeholder }: { label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: "'Outfit', sans-serif", display: 'block', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', background: 'var(--bg-elevated)', border: '0.5px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)', fontFamily: "'Outfit', sans-serif", outline: 'none', colorScheme: 'dark' }}
      />
    </div>
  )
}

export default Recall
