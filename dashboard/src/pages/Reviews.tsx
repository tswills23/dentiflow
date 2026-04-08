import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useRealtime } from '../hooks/useRealtime'

interface ReviewsProps {
  practiceId: string
}

interface ReviewSequenceRow {
  id: string
  practice_id: string
  patient_id: string
  status: string
  satisfaction_score: number | null
  review_url_sent: boolean
  referral_sent: boolean
  created_at: string
  updated_at: string
}

interface ReviewFeedbackRow {
  id: string
  practice_id: string
  patient_id: string
  review_sequence_id: string
  score: number
  feedback_text: string
  acknowledged: boolean
  created_at: string
  patients?: { first_name: string | null; last_name: string | null; phone: string | null }
}

interface ReferralRow {
  id: string
  practice_id: string
  referring_patient_id: string
  referred_name: string | null
  referred_phone: string | null
  status: string
  created_at: string
}

interface ReviewMetrics {
  surveysSent: number
  responseRate: number
  avgSatisfactionScore: number
  reviewLinksSent: number
  referralsGenerated: number
  referralConversionRate: number
}

type ActiveTab = 'overview' | 'feedback' | 'referrals'

function Reviews({ practiceId }: ReviewsProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [metrics, setMetrics] = useState<ReviewMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [feedbackList, setFeedbackList] = useState<ReviewFeedbackRow[]>([])
  const [feedbackLoading, setFeedbackLoading] = useState(true)
  const [showUnacknowledgedOnly, setShowUnacknowledgedOnly] = useState(true)

  // Real-time review sequences for activity feed
  const { data: sequences, loading: sequencesLoading } = useRealtime<ReviewSequenceRow>({
    table: 'review_sequences',
    practiceId,
    orderBy: { column: 'created_at', ascending: false },
    limit: 20,
  })

  // Real-time referrals
  const { data: referrals, loading: referralsLoading } = useRealtime<ReferralRow>({
    table: 'referrals',
    practiceId,
    orderBy: { column: 'created_at', ascending: false },
    limit: 20,
  })

  // Fetch metrics
  useEffect(() => {
    if (!practiceId) return

    async function fetchMetrics() {
      setMetricsLoading(true)
      try {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

        const { data: dailyMetrics } = await supabase
          .from('metrics_daily')
          .select('review_surveys_sent, review_scores_received, review_links_sent, referrals_generated, referrals_converted')
          .eq('practice_id', practiceId)
          .gte('date', startOfMonth)
          .lte('date', endOfMonth)

        const totals = (dailyMetrics || []).reduce(
          (acc: ReviewMetrics, row: Record<string, number>) => ({
            surveysSent: acc.surveysSent + (row.review_surveys_sent || 0),
            responseRate: 0,
            avgSatisfactionScore: 0,
            reviewLinksSent: acc.reviewLinksSent + (row.review_links_sent || 0),
            referralsGenerated: acc.referralsGenerated + (row.referrals_generated || 0),
            referralConversionRate: 0,
          }),
          { surveysSent: 0, responseRate: 0, avgSatisfactionScore: 0, reviewLinksSent: 0, referralsGenerated: 0, referralConversionRate: 0 }
        )

        const scoresReceived = (dailyMetrics || []).reduce((sum: number, row: Record<string, number>) => sum + (row.review_scores_received || 0), 0)
        const referralsConverted = (dailyMetrics || []).reduce((sum: number, row: Record<string, number>) => sum + (row.referrals_converted || 0), 0)

        totals.responseRate = totals.surveysSent > 0 ? Math.round((scoresReceived / totals.surveysSent) * 100) : 0
        totals.referralConversionRate = totals.referralsGenerated > 0 ? Math.round((referralsConverted / totals.referralsGenerated) * 100) : 0

        // Avg satisfaction
        const { data: scores } = await supabase
          .from('review_sequences')
          .select('satisfaction_score')
          .eq('practice_id', practiceId)
          .not('satisfaction_score', 'is', null)
          .gte('created_at', `${startOfMonth}T00:00:00Z`)

        totals.avgSatisfactionScore = scores && scores.length > 0
          ? Math.round((scores.reduce((sum: number, s: { satisfaction_score: number | null }) => sum + (s.satisfaction_score || 0), 0) / scores.length) * 10) / 10
          : 0

        setMetrics(totals)
      } catch {
        console.error('[Reviews] Failed to fetch metrics')
      }
      setMetricsLoading(false)
    }

    fetchMetrics()
  }, [practiceId])

  // Fetch feedback
  const fetchFeedback = useCallback(async () => {
    if (!practiceId) return
    setFeedbackLoading(true)

    let query = supabase
      .from('review_feedback')
      .select('*, patients!inner(first_name, last_name, phone)')
      .eq('practice_id', practiceId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (showUnacknowledgedOnly) {
      query = query.eq('acknowledged', false)
    }

    const { data } = await query
    setFeedbackList((data || []) as ReviewFeedbackRow[])
    setFeedbackLoading(false)
  }, [practiceId, showUnacknowledgedOnly])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  async function acknowledgeFeedback(id: string) {
    await supabase.from('review_feedback').update({ acknowledged: true }).eq('id', id)
    setFeedbackList(prev => prev.map(f => f.id === id ? { ...f, acknowledged: true } : f))
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

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      survey_sent: 'Survey Sent',
      survey_reminded: 'Reminded',
      score_received: 'Score Received',
      review_requested: 'Review Requested',
      referral_sent: 'Referral Sent',
      feedback_received: 'Feedback Received',
      completed: 'Completed',
      no_response: 'No Response',
    }
    return labels[status] || status
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'survey_sent':
      case 'survey_reminded': return 'var(--amber)'
      case 'score_received':
      case 'review_requested': return 'var(--accent)'
      case 'referral_sent':
      case 'completed': return 'var(--accent)'
      case 'feedback_received': return 'var(--blue)'
      case 'no_response': return 'var(--text-faint)'
      default: return 'var(--text-muted)'
    }
  }

  function getReferralStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'var(--amber)'
      case 'contacted': return 'var(--blue)'
      case 'booked':
      case 'converted': return 'var(--accent)'
      case 'declined': return 'var(--red)'
      default: return 'var(--text-muted)'
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 4) return 'var(--accent)'
    if (score === 3) return 'var(--amber)'
    return 'var(--red)'
  }

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'feedback', label: 'Feedback Queue' },
    { key: 'referrals', label: 'Referrals' },
  ]

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Reviews & Referrals
        </h2>
        <div className="flex items-center gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: 13,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif",
                background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.key ? '#0C0F12' : 'var(--text-muted)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Cards (always visible) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4" style={{ marginBottom: 24 }}>
        <MetricCard
          label="Surveys Sent"
          value={metrics?.surveysSent ?? 0}
          suffix=""
          dotClass="dot-amber"
          color="var(--amber)"
          sublabel="this month"
          loading={metricsLoading}
        />
        <MetricCard
          label="Response Rate"
          value={metrics?.responseRate ?? 0}
          suffix="%"
          dotClass="dot-accent"
          color="var(--accent)"
          sublabel="scores received / surveys"
          loading={metricsLoading}
        />
        <MetricCard
          label="Avg Score"
          value={metrics?.avgSatisfactionScore ?? 0}
          suffix="/5"
          dotClass="dot-accent"
          color="var(--accent)"
          sublabel="satisfaction this month"
          loading={metricsLoading}
          isDecimal
        />
        <MetricCard
          label="Reviews Generated"
          value={metrics?.reviewLinksSent ?? 0}
          suffix=""
          dotClass="dot-blue"
          color="var(--blue)"
          sublabel="Google review links sent"
          loading={metricsLoading}
        />
        <MetricCard
          label="Referrals"
          value={metrics?.referralsGenerated ?? 0}
          suffix=""
          dotClass="dot-accent"
          color="var(--accent)"
          sublabel="referral links sent"
          loading={metricsLoading}
        />
        <MetricCard
          label="Referral Conv."
          value={metrics?.referralConversionRate ?? 0}
          suffix="%"
          dotClass="dot-accent"
          color="var(--accent)"
          sublabel="referrals converted"
          loading={metricsLoading}
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="card animate-fade-in" style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Recent Activity
          </p>
          {sequencesLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ height: 20, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }} />
              ))}
            </div>
          ) : sequences.length > 0 ? (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {sequences.map((seq, idx) => (
                <div
                  key={seq.id}
                  className="flex items-center justify-between"
                  style={{
                    padding: '12px 0',
                    borderBottom: idx < sequences.length - 1 ? '0.5px solid var(--border-default)' : 'none',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span className="dot" style={{ background: getStatusColor(seq.status), width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
                        {getStatusLabel(seq.status)}
                        {seq.satisfaction_score !== null && (
                          <span style={{ marginLeft: 8, fontWeight: 600, color: getScoreColor(seq.satisfaction_score) }}>
                            {seq.satisfaction_score}/5
                          </span>
                        )}
                      </p>
                      <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{timeAgo(seq.updated_at || seq.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {seq.review_url_sent && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'rgba(52,211,153,0.1)', color: 'var(--accent)', fontWeight: 500 }}>
                        Review Sent
                      </span>
                    )}
                    {seq.referral_sent && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'rgba(96,165,250,0.1)', color: 'var(--blue)', fontWeight: 500 }}>
                        Referral Sent
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ height: 160, color: 'var(--text-faint)', fontSize: 13 }}>
              No review activity yet
            </div>
          )}
        </div>
      )}

      {activeTab === 'feedback' && (
        <div className="card animate-fade-in" style={{ padding: '1.5rem' }}>
          <div className="flex items-center justify-between mb-4">
            <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: 0 }}>
              Patient Feedback (Score 1-3)
            </p>
            <label className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showUnacknowledgedOnly}
                onChange={(e) => setShowUnacknowledgedOnly(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              Unacknowledged only
            </label>
          </div>
          {feedbackLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 60, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
              ))}
            </div>
          ) : feedbackList.length > 0 ? (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {feedbackList.map((fb, idx) => {
                const patientName = fb.patients
                  ? [fb.patients.first_name, fb.patients.last_name].filter(Boolean).join(' ') || 'Unknown'
                  : 'Unknown'
                return (
                  <div
                    key={fb.id}
                    style={{
                      padding: '14px 0',
                      borderBottom: idx < feedbackList.length - 1 ? '0.5px solid var(--border-default)' : 'none',
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span style={{ fontSize: 18, fontWeight: 700, color: getScoreColor(fb.score) }}>{fb.score}/5</span>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{patientName}</span>
                          {fb.patients?.phone && (
                            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{fb.patients.phone}</span>
                          )}
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                          "{fb.feedback_text}"
                        </p>
                        <span style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, display: 'inline-block' }}>
                          {timeAgo(fb.created_at)}
                        </span>
                      </div>
                      {!fb.acknowledged && (
                        <button
                          onClick={() => acknowledgeFeedback(fb.id)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 12,
                            fontWeight: 500,
                            border: '1px solid var(--border-default)',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontFamily: "'Outfit', sans-serif",
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          Acknowledge
                        </button>
                      )}
                      {fb.acknowledged && (
                        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          Acknowledged
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ height: 160, color: 'var(--text-faint)', fontSize: 13 }}>
              {showUnacknowledgedOnly ? 'No unacknowledged feedback' : 'No feedback received yet'}
            </div>
          )}
        </div>
      )}

      {activeTab === 'referrals' && (
        <div className="card animate-fade-in" style={{ padding: '1.5rem' }}>
          <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Referral Tracking
          </p>
          {referralsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: 40, background: 'rgba(255,255,255,0.03)', borderRadius: 4 }} />
              ))}
            </div>
          ) : referrals.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Referred Name', 'Phone', 'Status', 'Date'].map(header => (
                      <th
                        key={header}
                        style={{
                          textAlign: 'left',
                          padding: '8px 12px',
                          fontSize: 11,
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          color: 'var(--text-faint)',
                          borderBottom: '0.5px solid var(--border-default)',
                        }}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {referrals.map(ref => (
                    <tr key={ref.id}>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)' }}>
                        {ref.referred_name || 'Pending'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
                        {ref.referred_phone || '-'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: 11,
                          padding: '2px 10px',
                          borderRadius: 'var(--radius-pill)',
                          background: `color-mix(in srgb, ${getReferralStatusColor(ref.status)} 15%, transparent)`,
                          color: getReferralStatusColor(ref.status),
                          fontWeight: 500,
                          textTransform: 'capitalize',
                        }}>
                          {ref.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-faint)' }}>
                        {timeAgo(ref.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center" style={{ height: 160, color: 'var(--text-faint)', fontSize: 13 }}>
              No referrals yet
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Metric card component
function MetricCard({ label, value, suffix, dotClass, color, sublabel, loading, isDecimal }: {
  label: string
  value: number
  suffix: string
  dotClass: string
  color: string
  sublabel: string
  loading: boolean
  isDecimal?: boolean
}) {
  return (
    <div className="card animate-fade-in" style={{ padding: '1.25rem 1.5rem' }}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`dot ${dotClass}`} />
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</span>
      </div>
      {loading ? (
        <div style={{ height: 32, background: 'rgba(255,255,255,0.03)', borderRadius: 4, width: 60 }} />
      ) : (
        <p className="font-metric" style={{ fontSize: 32, color, lineHeight: 1, margin: 0 }}>
          {isDecimal ? value.toFixed(1) : value}{suffix}
        </p>
      )}
      <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>{sublabel}</p>
    </div>
  )
}

export default Reviews
