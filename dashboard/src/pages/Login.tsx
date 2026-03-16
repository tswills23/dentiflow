import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ResolvedBranding } from '../hooks/useBranding'

interface LoginProps {
  branding: ResolvedBranding
}

function Login({ branding }: LoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
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
      <div style={{ maxWidth: 400, width: '100%' }}>
        {/* Branding */}
        <div className="text-center" style={{ marginBottom: 32 }}>
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.practice_display_name}
              className="mx-auto object-contain"
              style={{ height: 64, marginBottom: 16 }}
            />
          ) : (
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
          )}
          <h1 className="font-metric" style={{ fontSize: 28, color: 'var(--text-primary)', margin: 0 }}>
            {branding.practice_display_name}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8, fontFamily: "'Outfit', sans-serif" }}>
            {branding.login_headline}
          </p>
        </div>

        {/* Login Card */}
        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 24px', fontFamily: "'Outfit', sans-serif" }}>
            Sign in to your account
          </h2>

          {error && (
            <div style={{
              marginBottom: 16,
              padding: 12,
              background: 'var(--red-dim)',
              borderRadius: 'var(--radius-sm)',
              border: '0.5px solid rgba(248, 113, 113, 0.2)',
            }}>
              <p style={{ fontSize: 13, color: 'var(--red)', margin: 0 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, fontFamily: "'Outfit', sans-serif" }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@practice.com"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-elevated)',
                  border: '0.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontFamily: "'Outfit', sans-serif",
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6, fontFamily: "'Outfit', sans-serif" }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'var(--bg-elevated)',
                  border: '0.5px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontFamily: "'Outfit', sans-serif",
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 'var(--radius-sm)',
                background: loading ? 'var(--accent-dark)' : 'var(--accent)',
                color: '#0C0F12',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "'Outfit', sans-serif",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: '#0C0F12' }} />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-faint)' }}>
          Powered by DentiFlow.ai
        </p>
      </div>
    </div>
  )
}

export default Login
