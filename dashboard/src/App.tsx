import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import type { User } from '@supabase/supabase-js'
import { useBranding } from './hooks/useBranding'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Conversations from './pages/Conversations'
import Appointments from './pages/Appointments'

interface UserProfile {
  id: string
  practice_id: string
  role: string
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [practiceConfig, setPracticeConfig] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const navigate = useNavigate()

  const branding = useBranding(practiceConfig)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setPracticeConfig(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, practice_id, role')
        .eq('auth_user_id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error.message)
      } else {
        setProfile(data as UserProfile)

        if (data?.practice_id) {
          const { data: practice } = await supabase
            .from('practices')
            .select('practice_config')
            .eq('id', data.practice_id)
            .single()

          if (practice?.practice_config) {
            setPracticeConfig(practice.practice_config as Record<string, unknown>)
          }
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setPracticeConfig(null)
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: 'var(--accent)' }} />
          <p className="mt-4" style={{ color: 'var(--text-muted)', fontFamily: "'Outfit', sans-serif" }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login branding={branding} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  const practiceId = profile?.practice_id ?? ''

  const navItems = [
    {
      path: '/',
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      path: '/leads',
      label: 'Leads',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      path: '/conversations',
      label: 'Conversations',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      path: '/appointments',
      label: 'Appointments',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar — Desktop */}
      <aside
        className="sidebar-desktop flex flex-col transition-all duration-300"
        style={{
          width: sidebarOpen ? 220 : 64,
          background: 'var(--bg-surface)',
          borderRight: '0.5px solid var(--border-default)',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div className="flex items-center px-4" style={{ height: 64, borderBottom: '0.5px solid var(--border-default)' }}>
          <div className="flex items-center gap-3">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="" className="flex-shrink-0 object-contain" style={{ width: 38, height: 38, borderRadius: 12 }} />
            ) : (
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--accent)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0C0F12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a7 7 0 00-7 7c0 3 2 5 3 7h8c1-2 3-4 3-7a7 7 0 00-7-7z" />
                  <path d="M9 16v2a3 3 0 006 0v-2" />
                </svg>
              </div>
            )}
            {sidebarOpen && (
              <div className="min-w-0">
                <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 20, color: 'var(--text-primary)', lineHeight: 1.2, margin: 0 }}>
                  {branding.practice_display_name}
                </h1>
                <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 400, fontSize: 10, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0, marginTop: 2 }}>
                  AI practice engine
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className="flex items-center px-3 py-2.5 rounded-lg"
              style={({ isActive }) => ({
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                fontFamily: "'Outfit', sans-serif",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                transition: 'color 0.15s, background 0.15s',
              })}
            >
              {item.icon}
              {sidebarOpen && <span className="ml-3">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div style={{ borderTop: '0.5px solid var(--border-default)', padding: 16 }}>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                {user?.email?.charAt(0)?.toUpperCase() ?? 'U'}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                  {user?.email ?? 'User'}
                </p>
                <p className="truncate" style={{ fontSize: 11, color: 'var(--text-faint)', margin: 0 }}>
                  {profile?.role ?? 'Staff'}
                </p>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <button
              onClick={handleSignOut}
              className="flex items-center justify-center w-full px-3 py-2 rounded-lg mt-3"
              style={{ fontSize: 13, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            padding: 12,
            color: 'var(--text-faint)',
            borderTop: '0.5px solid var(--border-default)',
            background: 'transparent',
            border: 'none',
            borderTopStyle: 'solid' as const,
            borderTopWidth: '0.5px',
            borderTopColor: 'var(--border-default)',
            cursor: 'pointer',
          }}
        >
          <svg
            className={`w-5 h-5 mx-auto transition-transform ${sidebarOpen ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center justify-between px-6 flex-shrink-0"
          style={{
            height: 64,
            background: 'var(--bg-primary)',
            borderBottom: '0.5px solid var(--border-default)',
          }}
        >
          <div />
          {/* Practice live pill */}
          <div
            className="flex items-center gap-2"
            style={{
              background: 'var(--accent-dim)',
              borderRadius: 'var(--radius-pill)',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--accent)',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            <span className="animate-pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            <span>{branding.practice_display_name}</span>
            <span style={{ fontWeight: 600 }}>Live</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto main-content">
          <Routes>
            <Route path="/" element={<Dashboard practiceId={practiceId} />} />
            <Route path="/leads" element={<Leads practiceId={practiceId} />} />
            <Route path="/conversations" element={<Conversations practiceId={practiceId} />} />
            <Route path="/appointments" element={<Appointments practiceId={practiceId} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      {/* Bottom nav — Mobile only */}
      <nav
        className="bottom-nav fixed bottom-0 left-0 right-0 items-center justify-around"
        style={{
          height: 64,
          background: 'var(--bg-surface)',
          borderTop: '0.5px solid var(--border-default)',
          zIndex: 50,
          display: 'none',
        }}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className="flex flex-col items-center justify-center flex-1"
            style={({ isActive }) => ({
              color: isActive ? 'var(--accent)' : 'var(--text-faint)',
              fontSize: 10,
              fontWeight: 500,
              gap: 4,
              height: '100%',
              textDecoration: 'none',
            })}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default App
