import React from 'react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  trend?: { value: number; positive: boolean }
}

function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <div className="card card-hover" style={{ padding: '1.25rem 1.5rem' }}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', fontFamily: "'Outfit', sans-serif" }}>
            {title}
          </p>
          <p className="font-metric" style={{ fontSize: 32, color: 'var(--text-primary)', marginTop: 8, lineHeight: 1 }}>
            {value}
          </p>
          {subtitle && (
            <p style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 6, fontFamily: "'Outfit', sans-serif" }}>
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="flex items-center mt-2">
              <span
                className="inline-flex items-center"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: trend.positive ? 'var(--accent)' : 'var(--red)',
                }}
              >
                {trend.positive ? (
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                )}
                {trend.value}%
              </span>
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-faint)' }}>vs last period</span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className="ml-4 flex-shrink-0 flex items-center justify-center"
            style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

export default StatCard
