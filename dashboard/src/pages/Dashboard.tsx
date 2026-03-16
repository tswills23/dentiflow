import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtime } from '../hooks/useRealtime'

interface DashboardProps {
  practiceId: string
}

interface MetricsDaily {
  id: string
  practice_id: string
  date: string
  new_leads: number
  appointments_booked: number
  estimated_revenue_recovered: number
  avg_response_time_ms: number
  total_responses: number
  under_60s_count: number
}

interface AutomationLogEntry {
  id: string
  practice_id: string
  created_at: string
  event_type: string
  description: string
  patient_name?: string
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

function Dashboard({ practiceId }: DashboardProps) {
  const [period, setPeriod] = useState<Period>('monthly')
  const [activityLog, setActivityLog] = useState<AutomationLogEntry[]>([])
  const [activityLoading, setActivityLoading] = useState(true)

  const dateRange = useMemo(() => {
    const end = new Date()
    const start = new Date()
    if (period === 'weekly') {
      start.setDate(end.getDate() - 7)
    } else {
      start.setDate(end.getDate() - 30)
    }
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    }
  }, [period])

  const { data: metrics, loading: metricsLoading } = useRealtime<MetricsDaily>({
    table: 'metrics_daily',
    practiceId,
    orderBy: { column: 'date', ascending: true },
  })

  const filteredMetrics = useMemo(() => {
    return metrics.filter(
      (m) => m.date >= dateRange.start && m.date <= dateRange.end
    )
  }, [metrics, dateRange])

  const stats = useMemo(() => {
    if (filteredMetrics.length === 0) {
      return { revenue: 0, leads: 0, appointments: 0, avgResponseTime: 0, under60Percentage: 0 }
    }

    const revenue = filteredMetrics.reduce((sum, m) => sum + (m.estimated_revenue_recovered ?? 0), 0)
    const leads = filteredMetrics.reduce((sum, m) => sum + (m.new_leads ?? 0), 0)
    const appointments = filteredMetrics.reduce((sum, m) => sum + (m.appointments_booked ?? 0), 0)
    const totalResponses = filteredMetrics.reduce((sum, m) => sum + (m.total_responses ?? 0), 0)
    const weightedSum = filteredMetrics.reduce((sum, m) => sum + (m.avg_response_time_ms ?? 0) * (m.total_responses ?? 0), 0)
    const avgResponseTime = totalResponses > 0 ? weightedSum / totalResponses : 0
    const totalUnder60s = filteredMetrics.reduce((sum, m) => sum + (m.under_60s_count ?? 0), 0)
    const under60Percentage = totalResponses > 0 ? (totalUnder60s / totalResponses) * 100 : 0

    return { revenue, leads, appointments, avgResponseTime, under60Percentage }
  }, [filteredMetrics])

  const animatedRevenue = useCountUp(stats.revenue, 800)

  useEffect(() => {
    if (!practiceId) return

    async function fetchLog() {
      setActivityLoading(true)
      const { data, error } = await supabase
        .from('automation_log')
        .select('*')
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && data) {
        setActivityLog(data as AutomationLogEntry[])
      }
      setActivityLoading(false)
    }

    fetchLog()

    const channel = supabase
      .channel('automation_log_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'automation_log',
          filter: `practice_id=eq.${practiceId}`,
        },
        (payload) => {
          setActivityLog((prev) => [payload.new as AutomationLogEntry, ...prev.slice(0, 9)])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [practiceId])

  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }, [])

  function formatResponseTime(ms: number): string {
    const seconds = ms / 1000
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    const minutes = Math.floor(seconds / 60)
    const remaining = Math.round(seconds % 60)
    return `${minutes}m ${remaining}s`
  }

  function getEventDotClass(eventType: string): string {
    switch (eventType) {
      case 'appointment_booked': return 'dot-accent'
      case 'lead_created': return 'dot-blue'
      case 'follow_up': return 'dot-amber'
      case 'emergency': return 'dot-red'
      case 'sms_sent': return 'dot-accent'
      case 'ai_response': return 'dot-blue'
      default: return 'dot-blue'
    }
  }

  function timeAgo(dateStr: string): string {
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
  }

  const responseTimeSec = stats.avgResponseTime / 1000

  if (metricsLoading) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <div className="space-y-6">
          <div className="card" style={{ height: 160, opacity: 0.3 }} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card" style={{ height: 120, opacity: 0.3 }} />
            ))}
          </div>
          <div className="card" style={{ height: 300, opacity: 0.3 }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Revenue Hero Card */}
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
            <p className="font-metric" style={{ fontSize: 56, color: 'var(--text-primary)', margin: '8px 0 0', lineHeight: 1 }}>
              {formatCurrency(animatedRevenue)}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                <svg className="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                {period === 'weekly' ? 'Last 7 days' : 'Last 30 days'}
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: 0 }}>
              Chairs Filled
            </p>
            <p className="font-metric" style={{ fontSize: 32, color: 'var(--accent)', margin: '8px 0 0', lineHeight: 1 }}>
              {stats.appointments}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>appointments booked</p>
          </div>
        </div>

        {/* Period toggle */}
        <div className="flex items-center gap-1 mt-4">
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

      {/* Metric Cards - 2x2 grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 24 }}>
        <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: '0ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="dot dot-blue" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>New leads</span>
          </div>
          <p className="font-metric" style={{ fontSize: 32, color: 'var(--blue)', lineHeight: 1, margin: 0 }}>
            {stats.leads}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
            {period === 'weekly' ? 'this week' : 'this month'} via SMS + voice
          </p>
        </div>

        <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: '50ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="dot dot-accent" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Booked</span>
          </div>
          <p className="font-metric" style={{ fontSize: 32, color: 'var(--accent)', lineHeight: 1, margin: 0 }}>
            {stats.appointments}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>recall + new patients</p>
        </div>

        <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: '100ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="dot dot-amber" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Recall contacted</span>
          </div>
          <p className="font-metric" style={{ fontSize: 32, color: 'var(--amber)', lineHeight: 1, margin: 0 }}>
            {filteredMetrics.reduce((sum, m) => sum + (m.total_responses ?? 0), 0)}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>total responses sent</p>
        </div>

        <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem', animationDelay: '150ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="dot dot-red" />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Avg Response</span>
          </div>
          <p className="font-metric" style={{ fontSize: 32, color: 'var(--red)', lineHeight: 1, margin: 0 }}>
            {formatResponseTime(stats.avgResponseTime)}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>first response time</p>
        </div>
      </div>

      {/* Two-column: Activity Feed + Response Speed */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Activity Feed */}
        <div className="lg:col-span-3 card animate-fade-in" style={{ padding: '1.5rem', animationDelay: '200ms' }}>
          <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Live Activity
          </p>
          {activityLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} style={{ height: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }} />
              ))}
            </div>
          ) : activityLog.length > 0 ? (
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {activityLog.map((entry, idx) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3"
                  style={{
                    padding: '10px 0',
                    borderBottom: idx < activityLog.length - 1 ? '0.5px solid var(--border-default)' : 'none',
                  }}
                >
                  <span className={`dot ${getEventDotClass(entry.event_type)}`} style={{ marginTop: 5 }} />
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                      {entry.description}
                    </p>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {timeAgo(entry.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ height: 160, color: 'var(--text-faint)', fontSize: 13 }}>
              No recent activity
            </div>
          )}
        </div>

        {/* Response Speed */}
        <div className="lg:col-span-2 card animate-fade-in" style={{ padding: '1.5rem', animationDelay: '250ms' }}>
          <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: '0 0 24px' }}>
            Response Speed
          </p>
          <div className="flex flex-col items-center">
            <div className="text-center mb-6">
              <span className="font-metric" style={{ fontSize: 64, color: 'var(--accent)', lineHeight: 1 }}>
                {responseTimeSec > 0 ? responseTimeSec.toFixed(1) : '0.0'}
              </span>
              <span style={{ fontSize: 24, color: 'var(--text-muted)', fontFamily: "'Outfit', sans-serif", marginLeft: 4 }}>s</span>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>average first response</p>
            </div>

            <div style={{ width: '100%', maxWidth: 240 }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>SMS</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{responseTimeSec > 0 ? (responseTimeSec * 0.8).toFixed(1) : '0.0'}s</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginBottom: 12 }}>
                <div style={{ height: 4, background: 'var(--accent)', borderRadius: 2, width: `${Math.min(80, 100)}%`, transition: 'width 0.5s ease' }} />
              </div>

              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>Voice</span>
                <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{responseTimeSec > 0 ? (responseTimeSec * 1.4).toFixed(1) : '0.0'}s</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginBottom: 16 }}>
                <div style={{ height: 4, background: 'var(--blue)', borderRadius: 2, width: `${Math.min(60, 100)}%`, transition: 'width 0.5s ease' }} />
              </div>
            </div>

            <div className="text-center" style={{ borderTop: '0.5px solid var(--border-default)', paddingTop: 16, width: '100%' }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent)' }}>
                {Math.round(stats.under60Percentage)}%
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 6 }}>
                responded under 60 seconds
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
