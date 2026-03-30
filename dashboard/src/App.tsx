import { useState, useEffect, useRef } from 'react'
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { useBranding } from './hooks/useBranding'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import PracticeSelector from './pages/PracticeSelector'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Conversations from './pages/Conversations'
import Appointments from './pages/Appointments'
import Recall from './pages/Recall'
import Reviews from './pages/Reviews'

interface PracticeName {
  id: string
  name: string
}

function App() {
  const {
    user,
    profiles,
    activePracticeId,
    practiceConfig,
    loading,
    needsPracticeSelection,
    selectPractice,
    signOut,
  } = useAuth()
  const navigate = useNavigate()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [practiceNames, setPracticeNames] = useState<PracticeName[]>([])
  const switcherRef = useRef<HTMLDivElement>(null)

  const branding = useBranding(practiceConfig)
  const hasMultiplePractices = profiles.length > 1

  // Fetch practice names for the switcher dropdown
  useEffect(() => {
    if (!hasMultiplePractices) return

    async function fetchNames() {
      const ids = profiles.map((p) => p.practice_id)
      const { data } = await supabase.from('practices').select('id, name').in('id', ids)
      if (data) setPracticeNames(data as PracticeName[])
    }

    fetchNames()
  }, [profiles, hasMultiplePractices])

  // Close switcher dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    if (switcherOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [switcherOpen])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  async function handleSwitchPractice(practiceId: string) {
    setSwitcherOpen(false)
    await selectPractice(practiceId)
  }

  // Loading state
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

  // Not authenticated — login only
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login branding={branding} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Authenticated but needs to pick a practice
  if (needsPracticeSelection) {
    return <PracticeSelector />
  }

  const practiceId = activePracticeId ?? ''
  const currentPracticeName = practiceNames.find((p) => p.id === activePracticeId)?.name ?? branding.practice_display_name

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
      path: '/reactivation',
      label: 'Reactivation',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      path: '/reviews',
      label: 'Reviews',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
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

        {/* Practice Switcher (multi-practice users only) */}
        {hasMultiplePractices && sidebarOpen && (
          <div ref={switcherRef} style={{ padding: '8px 12px', borderBottom: '0.5px solid var(--border-default)', position: 'relative' }}>
            <button
              onClick={() => setSwitcherOpen(!switcherOpen)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: switcherOpen ? 'var(--bg-elevated)' : 'transparent',
                border: '0.5px solid var(--border-default)',
                cursor: 'pointer',
                fontFamily: "'Outfit', sans-serif",
                fontSize: 12,
                color: 'var(--text-primary)',
                transition: 'background 0.15s',
              }}
            >
              <span className="truncate" style={{ fontWeight: 500 }}>{currentPracticeName}</span>
              <svg
                className="flex-shrink-0"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: switcherOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Dropdown */}
            {switcherOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 12,
                  right: 12,
                  zIndex: 50,
                  marginTop: 4,
                  background: 'var(--bg-elevated)',
                  border: '0.5px solid var(--border-hover)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}
              >
                {practiceNames.map((practice) => (
                  <button
                    key={practice.id}
                    onClick={() => handleSwitchPractice(practice.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      background: practice.id === activePracticeId ? 'var(--accent-dim)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: 13,
                      fontWeight: practice.id === activePracticeId ? 600 : 400,
                      color: practice.id === activePracticeId ? 'var(--accent)' : 'var(--text-primary)',
                      textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => {
                      if (practice.id !== activePracticeId) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (practice.id !== activePracticeId) {
                        e.currentTarget.style.background = 'transparent'
                      }
                    }}
                  >
                    {practice.id === activePracticeId && (
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="var(--accent)" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    <span className="truncate">{practice.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

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
                  {profiles.find((p) => p.practice_id === activePracticeId)?.role ?? 'Staff'}
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
            <Route path="/reactivation" element={<Recall practiceId={practiceId} />} />
            <Route path="/reviews" element={<Reviews practiceId={practiceId} />} />
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
