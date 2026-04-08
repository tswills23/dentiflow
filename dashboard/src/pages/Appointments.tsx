import { useState, useMemo, useCallback } from 'react'
import { useRealtime } from '../hooks/useRealtime'
import StatusBadge, { getAppointmentVariant } from '../components/StatusBadge'

interface AppointmentsProps {
  practiceId: string
}

interface Appointment {
  id: string
  practice_id: string
  patient_id: string
  patient_name: string
  service: string
  provider: string | null
  scheduled_at: string
  status: string
  notes: string | null
  created_at: string
}

interface GroupedAppointments {
  date: string
  dateLabel: string
  appointments: Appointment[]
}

const API_BASE = import.meta.env.VITE_API_URL

function getSourceBadge(apt: Appointment): { label: string; background: string; color: string } | null {
  // Infer source from notes or default
  if (apt.notes?.toLowerCase().includes('recall')) {
    return { label: 'Reactivation', background: 'var(--amber-dim)', color: 'var(--amber)' }
  }
  if (apt.notes?.toLowerCase().includes('ai') || apt.notes?.toLowerCase().includes('auto')) {
    return { label: 'AI Booked', background: 'var(--accent-dim)', color: 'var(--accent)' }
  }
  return null
}

function Appointments({ practiceId }: AppointmentsProps) {
  const { data: appointments, loading } = useRealtime<Appointment>({
    table: 'appointments',
    practiceId,
    orderBy: { column: 'scheduled_at', ascending: true },
  })

  const [markingNoShow, setMarkingNoShow] = useState<string | null>(null)
  const [markingComplete, setMarkingComplete] = useState<string | null>(null)

  const handleMarkNoShow = useCallback(async (apt: Appointment) => {
    if (!confirm(`Mark ${apt.patient_name}'s appointment as No-Show? This will trigger an automatic recovery sequence.`)) {
      return
    }

    setMarkingNoShow(apt.id)
    try {
      const res = await fetch(`${API_BASE}/api/noshow/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId, appointmentId: apt.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to mark no-show')
      }
    } catch (err) {
      alert('Failed to connect to server')
    } finally {
      setMarkingNoShow(null)
    }
  }, [practiceId])

  const handleMarkComplete = useCallback(async (apt: Appointment) => {
    if (!confirm(`Mark ${apt.patient_name}'s appointment as Complete? This will trigger an automatic review survey.`)) {
      return
    }

    setMarkingComplete(apt.id)
    try {
      const res = await fetch(`${API_BASE}/api/appointments/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practiceId, appointmentId: apt.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to mark complete')
      }
    } catch (err) {
      alert('Failed to connect to server')
    } finally {
      setMarkingComplete(null)
    }
  }, [practiceId])

  const grouped = useMemo(() => {
    const groups = new Map<string, Appointment[]>()

    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - 7)

    const filtered = appointments.filter((a) => {
      const date = new Date(a.scheduled_at)
      return date >= cutoff
    })

    for (const apt of filtered) {
      const dateKey = new Date(apt.scheduled_at).toISOString().split('T')[0]
      if (!groups.has(dateKey)) {
        groups.set(dateKey, [])
      }
      groups.get(dateKey)!.push(apt)
    }

    const result: GroupedAppointments[] = []
    const sortedKeys = Array.from(groups.keys()).sort()

    for (const key of sortedKeys) {
      const date = new Date(key + 'T00:00:00')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      let dateLabel: string
      if (date.getTime() === today.getTime()) {
        dateLabel = 'Today'
      } else if (date.getTime() === tomorrow.getTime()) {
        dateLabel = 'Tomorrow'
      } else {
        dateLabel = date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      }

      const dayAppointments = groups.get(key)!.sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      )

      result.push({ date: key, dateLabel, appointments: dayAppointments })
    }

    return result
  }, [appointments])

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayAppointments = appointments.filter(
      (a) => a.scheduled_at.startsWith(today)
    )
    const upcoming = appointments.filter(
      (a) => new Date(a.scheduled_at) > new Date() && a.status !== 'cancelled'
    )
    const confirmed = appointments.filter((a) => a.status === 'confirmed')
    const noShows = appointments.filter((a) => a.status === 'no_show')

    return {
      todayCount: todayAppointments.length,
      upcomingCount: upcoming.length,
      confirmedCount: confirmed.length,
      noShowCount: noShows.length,
    }
  }, [appointments])

  function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  function canMarkNoShow(apt: Appointment): boolean {
    // Only allow marking past appointments as no-show (scheduled/confirmed that have passed)
    const isPast = new Date(apt.scheduled_at) < new Date()
    const isEligible = apt.status === 'scheduled' || apt.status === 'confirmed'
    return isPast && isEligible
  }

  function canMarkComplete(apt: Appointment): boolean {
    // Same eligibility: past scheduled/confirmed appointments that aren't already completed/no-show
    const isPast = new Date(apt.scheduled_at) < new Date()
    const isEligible = apt.status === 'scheduled' || apt.status === 'confirmed'
    return isPast && isEligible
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div className="space-y-4">
          <div className="card" style={{ height: 40, opacity: 0.3 }} />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ height: 80, opacity: 0.3 }} />
            ))}
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card" style={{ height: 80, opacity: 0.3 }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: "'Outfit', sans-serif" }}>Appointments</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Upcoming and recent appointments</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: 32 }}>
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Today</p>
          <p className="font-metric" style={{ fontSize: 28, color: 'var(--text-primary)', marginTop: 4, lineHeight: 1 }}>
            {stats.todayCount}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>appointments</p>
        </div>
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Upcoming</p>
          <p className="font-metric" style={{ fontSize: 28, color: 'var(--blue)', marginTop: 4, lineHeight: 1 }}>
            {stats.upcomingCount}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>scheduled</p>
        </div>
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Confirmed</p>
          <p className="font-metric" style={{ fontSize: 28, color: 'var(--accent)', marginTop: 4, lineHeight: 1 }}>
            {stats.confirmedCount}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>confirmed</p>
        </div>
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>No-Shows</p>
          <p className="font-metric" style={{ fontSize: 28, color: 'var(--red)', marginTop: 4, lineHeight: 1 }}>
            {stats.noShowCount}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>this period</p>
        </div>
      </div>

      {/* Grouped appointments */}
      {grouped.length === 0 ? (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <svg
            style={{ width: 64, height: 64, margin: '0 auto 16px', color: 'var(--text-faint)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-muted)' }}>No appointments</p>
          <p style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 4 }}>
            Appointments will appear here as they are booked
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => {
            const isToday = group.dateLabel === 'Today'

            return (
              <div key={group.date}>
                {/* Date header */}
                <div className="flex items-center mb-3 gap-3">
                  <h2 style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: isToday ? 'var(--accent)' : 'var(--text-muted)',
                    margin: 0,
                    fontFamily: "'Outfit', sans-serif",
                  }}>
                    {group.dateLabel}
                  </h2>
                  <span className="badge" style={{
                    background: isToday ? 'var(--accent-dim)' : 'rgba(255,255,255,0.06)',
                    color: isToday ? 'var(--accent)' : 'var(--text-faint)',
                  }}>
                    {group.appointments.length}
                  </span>
                  <div style={{ flex: 1, height: '0.5px', background: 'var(--border-default)' }} />
                </div>

                {/* Appointments table for this date */}
                <div className="card" style={{ overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Time', 'Patient', 'Service', 'Provider', 'Status', 'Source', ''].map((h, i) => (
                          <th
                            key={h || `action-${i}`}
                            style={{
                              textAlign: 'left',
                              padding: '10px 16px',
                              fontSize: 11,
                              fontWeight: 500,
                              textTransform: 'uppercase',
                              letterSpacing: '1px',
                              color: 'var(--text-faint)',
                              borderBottom: '0.5px solid var(--border-default)',
                              fontFamily: "'Outfit', sans-serif",
                              ...(h === '' ? { width: 200 } : {}),
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.appointments.map((apt) => {
                        const source = getSourceBadge(apt)
                        const showNoShowBtn = canMarkNoShow(apt)
                        const showCompleteBtn = canMarkComplete(apt)
                        const isMarking = markingNoShow === apt.id
                        const isCompleting = markingComplete === apt.id

                        return (
                          <tr
                            key={apt.id}
                            style={{
                              borderBottom: '0.5px solid var(--border-default)',
                              borderLeft: apt.status === 'no_show'
                                ? '3px solid var(--red)'
                                : isToday
                                  ? '3px solid var(--accent-dim)'
                                  : '3px solid transparent',
                            }}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <span className="font-metric" style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                                {formatTime(apt.scheduled_at)}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                                {apt.patient_name}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                              {apt.service}
                            </td>
                            <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-faint)' }}>
                              {apt.provider ?? '--'}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <StatusBadge
                                label={apt.status.replace('_', ' ')}
                                variant={getAppointmentVariant(apt.status)}
                              />
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {source ? (
                                <span className="badge" style={{ background: source.background, color: source.color }}>
                                  {source.label}
                                </span>
                              ) : (
                                <span className="badge badge-muted">Manual</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div className="flex items-center justify-end gap-2">
                                {showCompleteBtn && (
                                  <button
                                    onClick={() => handleMarkComplete(apt)}
                                    disabled={isCompleting}
                                    style={{
                                      padding: '5px 12px',
                                      fontSize: 11,
                                      fontWeight: 500,
                                      fontFamily: "'Outfit', sans-serif",
                                      borderRadius: 'var(--radius-pill)',
                                      border: '1px solid var(--accent)',
                                      background: 'transparent',
                                      color: 'var(--accent)',
                                      cursor: isCompleting ? 'not-allowed' : 'pointer',
                                      opacity: isCompleting ? 0.5 : 1,
                                      transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isCompleting) {
                                        e.currentTarget.style.background = 'var(--accent)'
                                        e.currentTarget.style.color = '#0C0F12'
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent'
                                      e.currentTarget.style.color = 'var(--accent)'
                                    }}
                                  >
                                    {isCompleting ? 'Completing...' : 'Complete'}
                                  </button>
                                )}
                                {showNoShowBtn && (
                                  <button
                                    onClick={() => handleMarkNoShow(apt)}
                                    disabled={isMarking}
                                    style={{
                                      padding: '5px 12px',
                                      fontSize: 11,
                                      fontWeight: 500,
                                      fontFamily: "'Outfit', sans-serif",
                                      borderRadius: 'var(--radius-pill)',
                                      border: '1px solid var(--red)',
                                      background: 'transparent',
                                      color: 'var(--red)',
                                      cursor: isMarking ? 'not-allowed' : 'pointer',
                                      opacity: isMarking ? 0.5 : 1,
                                      transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isMarking) {
                                        e.currentTarget.style.background = 'var(--red)'
                                        e.currentTarget.style.color = '#fff'
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent'
                                      e.currentTarget.style.color = 'var(--red)'
                                    }}
                                  >
                                    {isMarking ? 'Marking...' : 'No-Show'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Appointments
