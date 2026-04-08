import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface PracticeSummary {
  id: string
  name: string
}

function PracticeSelector() {
  const { profiles, selectPractice } = useAuth()
  const [practices, setPractices] = useState<PracticeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPracticeNames() {
      const practiceIds = profiles.map((p) => p.practice_id)
      const { data } = await supabase
        .from('practices')
        .select('id, name')
        .in('id', practiceIds)

      if (data) {
        setPractices(data as PracticeSummary[])
      }
      setLoading(false)
    }

    if (profiles.length > 0) {
      fetchPracticeNames()
    }
  }, [profiles])

  async function handleSelect(practiceId: string) {
    setSelecting(practiceId)
    await selectPractice(practiceId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto"
            style={{ borderColor: 'var(--accent)' }}
          />
          <p className="mt-4" style={{ color: 'var(--text-muted)', fontFamily: "'Outfit', sans-serif" }}>
            Loading practices...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center justify-center px-4"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(52,211,153,0.06) 0%, transparent 50%)',
      }}
    >
      <div style={{ maxWidth: 480, width: '100%' }}>
        {/* Header */}
        <div className="text-center" style={{ marginBottom: 32 }}>
          <div
            className="inline-flex items-center justify-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'var(--accent)',
              marginBottom: 16,
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0C0F12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 00-7 7c0 3 2 5 3 7h8c1-2 3-4 3-7a7 7 0 00-7-7z" />
              <path d="M9 16v2a3 3 0 006 0v-2" />
            </svg>
          </div>
          <h1 className="font-metric" style={{ fontSize: 28, color: 'var(--text-primary)', margin: 0 }}>
            Select Practice
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, fontFamily: "'Outfit', sans-serif" }}>
            Choose which practice to manage
          </p>
        </div>

        {/* Practice Cards */}
        <div className="flex flex-col gap-3">
          {practices.map((practice) => (
            <button
              key={practice.id}
              onClick={() => handleSelect(practice.id)}
              disabled={selecting !== null}
              className="card card-hover"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '20px 24px',
                border: '0.5px solid var(--border-default)',
                background: 'var(--bg-card)',
                cursor: selecting !== null ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                width: '100%',
                fontFamily: "'Outfit', sans-serif",
                opacity: selecting !== null && selecting !== practice.id ? 0.5 : 1,
                transition: 'border-color 0.15s, opacity 0.15s',
              }}
            >
              {/* Practice icon */}
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'var(--accent-dim)',
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="var(--accent)" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
              </div>

              {/* Practice name */}
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  {practice.name}
                </p>
              </div>

              {/* Loading or arrow */}
              {selecting === practice.id ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 flex-shrink-0" style={{ borderColor: 'var(--accent)' }} />
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="var(--text-faint)" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-faint)' }}>
          Powered by DentiFlow.ai
        </p>
      </div>
    </div>
  )
}

export default PracticeSelector
