import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useRealtime } from '../hooks/useRealtime'
import { useDashboardSettings } from '../hooks/useDashboardSettings'

interface DashboardProps {
  practiceId: string
}

interface MetricsDaily {
  id: string
  practice_id: string
  date: string
  new_leads: number
  appointments_booked: number
  total_responses: number
}

type Period = 'weekly' | 'monthly'

// Count-up animation hook
function useCountUp(target: number, duration: number = 800): number {
  const [value, setValue] = useState(0)
  const startRef = useRef<number | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    startRef.current = null
    const animate = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp
      const elapsed = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      }
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [target, duration])

  return value
}

interface RecallSequence {
  id: string
  practice_id: string
  booking_stage: string
  last_sent_at: string | null
}

function Dashboard({ practiceId }: DashboardProps) {
  const [period, setPeriod] = useState<Period>('monthly')
  const [recallSequences, setRecallSequences] = useState<RecallSequence[]>([])
  const [recallLoading, setRecallLoading] = useState(true)

  const { settings } = useDashboardSettings(practiceId)

  const dateRange = useMemo(() => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (period === 'weekly' ? 7 : 30))
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    }
  }, [period])

  const { data: metrics, loading: metricsLoading } = useRealtime<MetricsDaily>({
    table: 'metrics_daily',
    practiceId,
    orderBy: { column: 'date', ascending: true },
  })

  const filteredMetrics = useMemo(() => {
    return metrics.filter((m) => m.date >= dateRange.startDate && m.date <= dateRange.endDate)
  }, [metrics, dateRange])

  // Reactivation bookings are campaign-to-date (not period-scoped) — fetch all.
  useEffect(() => {
    if (!practiceId) return

    async function fetchRecall() {
      setRecallLoading(true)
      const allSeqs: RecallSequence[] = []
      const PAGE_SIZE = 1000
      let from = 0
      while (true) {
        const { data, error } = await supabase
          .from('recall_sequences')
          .select('id, practice_id, booking_stage, last_sent_at')
          .eq('practice_id', practiceId)
          .range(from, from + PAGE_SIZE - 1)

        if (error || !data) break
        allSeqs.push(...(data as RecallSequence[]))
        if (data.length < PAGE_SIZE) break
        from += PAGE_SIZE
      }
      setRecallSequences(allSeqs)
      setRecallLoading(false)
    }

    fetchRecall()
  }, [practiceId])

  const stats = useMemo(() => {
    const leads = filteredMetrics.reduce((sum, m) => sum + (m.new_leads ?? 0), 0)
    const appointments = filteredMetrics.reduce((sum, m) => sum + (m.appointments_booked ?? 0), 0)

    const liveBooked = recallSequences.filter((s) => s.booking_stage === 'S6_COMPLETED').length
    // Prefer the manually verified (Dentrix) total when set — Village has no live
    // PMS link, so the system-captured count alone undercounts reality.
    const reactivationBooked =
      settings.verified_bookings && settings.verified_bookings > 0
        ? settings.verified_bookings
        : liveBooked

    const avgValue = settings.avg_patient_value ?? 0
    const revenue = reactivationBooked * avgValue

    return { leads, appointments, reactivationBooked, avgValue, revenue }
  }, [filteredMetrics, recallSequences, settings])

  const animatedRevenue = useCountUp(stats.revenue, 800)

  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }, [])

  if (metricsLoading || recallLoading) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div className="space-y-6">
          <div className="card" style={{ height: 160, opacity: 0.3 }} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ height: 120, opacity: 0.3 }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const cardBase = {
    textDecoration: 'none' as const,
    display: 'block' as const,
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Revenue Hero Card — reactivation revenue recovered (campaign to date) */}
      <div
        className="card animate-fade-in"
        style={{
          padding: '1.75rem 2rem',
          marginBottom: 24,
          backgroundImage: 'radial-gradient(circle at 85% 15%, rgba(52,211,153,0.08) 0%, transparent 60%)',
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-6">
          <div>
            <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: 0 }}>
              Revenue Recovered
            </p>
            {stats.avgValue > 0 ? (
              <p className="font-metric" style={{ fontSize: 56, color: 'var(--text-primary)', margin: '8px 0 0', lineHeight: 1 }}>
                {formatCurrency(animatedRevenue)}
              </p>
            ) : (
              <Link
                to="/reactivation"
                style={{ fontSize: 22, color: 'var(--accent)', margin: '12px 0 0', display: 'inline-block', textDecoration: 'none' }}
              >
                Set patient value to see revenue →
              </Link>
            )}
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
              {stats.reactivationBooked} patient{stats.reactivationBooked === 1 ? '' : 's'} reactivated
              {stats.avgValue > 0 ? ` × ${formatCurrency(stats.avgValue)} avg value` : ''}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: 0 }}>
              Patients Reactivated
            </p>
            <p className="font-metric" style={{ fontSize: 32, color: 'var(--accent)', margin: '8px 0 0', lineHeight: 1 }}>
              {stats.reactivationBooked}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>booked back · campaign to date</p>
          </div>
        </div>
      </div>

      {/* Section summary cards — overview; click in for detail */}
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: 0 }}>
          This {period === 'weekly' ? 'Week' : 'Month'}
        </p>
        <div className="flex items-center gap-1">
          {(['weekly', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 12,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif",
                background: period === p ? 'var(--accent)' : 'transparent',
                color: period === p ? '#0C0F12' : 'var(--text-muted)',
              }}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Reactivations booked → detail */}
        <Link to="/reactivation" className="card card-hover animate-fade-in" style={{ ...cardBase, padding: '1.25rem 1.5rem', animationDelay: '0ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="dot dot-accent" />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Reactivations Booked</span>
            </div>
            <span style={{ fontSize: 16, color: 'var(--text-faint)' }}>→</span>
          </div>
          <p className="font-metric" style={{ fontSize: 32, color: 'var(--accent)', lineHeight: 1, margin: 0 }}>
            {stats.reactivationBooked}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>campaign to date · view funnel</p>
        </Link>

        {/* New leads → leads */}
        <Link to="/leads" className="card card-hover animate-fade-in" style={{ ...cardBase, padding: '1.25rem 1.5rem', animationDelay: '50ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="dot dot-blue" />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>New Leads</span>
            </div>
            <span style={{ fontSize: 16, color: 'var(--text-faint)' }}>→</span>
          </div>
          <p className="font-metric" style={{ fontSize: 32, color: 'var(--blue)', lineHeight: 1, margin: 0 }}>
            {stats.leads}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
            {period === 'weekly' ? 'this week' : 'this month'} via SMS + voice
          </p>
        </Link>

        {/* Appointments booked → appointments */}
        <Link to="/appointments" className="card card-hover animate-fade-in" style={{ ...cardBase, padding: '1.25rem 1.5rem', animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="dot dot-amber" />
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Appointments Booked</span>
            </div>
            <span style={{ fontSize: 16, color: 'var(--text-faint)' }}>→</span>
          </div>
          <p className="font-metric" style={{ fontSize: 32, color: 'var(--amber)', lineHeight: 1, margin: 0 }}>
            {stats.appointments}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
            {period === 'weekly' ? 'this week' : 'this month'}
          </p>
        </Link>
      </div>
    </div>
  )
}

export default Dashboard
