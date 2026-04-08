import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  practice_id: string
  role: string
}

export interface PracticeInfo {
  id: string
  name: string
  practice_config: Record<string, unknown> | null
}

interface AuthContextType {
  user: User | null
  profiles: UserProfile[]
  activePracticeId: string | null
  activePractice: PracticeInfo | null
  practiceConfig: Record<string, unknown> | null
  loading: boolean
  /** True when user is authenticated but has multiple practices and hasn't picked one yet */
  needsPracticeSelection: boolean
  selectPractice: (practiceId: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [activePracticeId, setActivePracticeId] = useState<string | null>(null)
  const [activePractice, setActivePractice] = useState<PracticeInfo | null>(null)
  const [practiceConfig, setPracticeConfig] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsPracticeSelection, setNeedsPracticeSelection] = useState(false)

  const fetchPractice = useCallback(async (practiceId: string) => {
    const { data: practice } = await supabase
      .from('practices')
      .select('id, name, practice_config')
      .eq('id', practiceId)
      .single()

    if (practice) {
      setActivePractice(practice as PracticeInfo)
      setPracticeConfig((practice.practice_config as Record<string, unknown>) ?? null)
    }
  }, [])

  const fetchProfiles = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, practice_id, role')
        .eq('auth_user_id', userId)

      if (error || !data || data.length === 0) {
        console.error('Error fetching profiles:', error?.message ?? 'No profiles found')
        setLoading(false)
        return
      }

      const userProfiles = data as UserProfile[]
      setProfiles(userProfiles)

      // Check localStorage for previously selected practice
      const savedPracticeId = localStorage.getItem('dentiflow_active_practice')
      const savedProfile = savedPracticeId
        ? userProfiles.find((p) => p.practice_id === savedPracticeId)
        : null

      if (userProfiles.length === 1) {
        // Single practice — auto-select
        setActivePracticeId(userProfiles[0].practice_id)
        await fetchPractice(userProfiles[0].practice_id)
        setNeedsPracticeSelection(false)
      } else if (savedProfile) {
        // Multi-practice user with saved selection
        setActivePracticeId(savedProfile.practice_id)
        await fetchPractice(savedProfile.practice_id)
        setNeedsPracticeSelection(false)
      } else {
        // Multi-practice user — needs to pick
        setNeedsPracticeSelection(true)
      }
    } catch (err) {
      console.error('Error fetching profiles:', err)
    } finally {
      setLoading(false)
    }
  }, [fetchPractice])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfiles(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null
      setUser(newUser)
      if (newUser) {
        fetchProfiles(newUser.id)
      } else {
        // Signed out — clear everything
        setProfiles([])
        setActivePracticeId(null)
        setActivePractice(null)
        setPracticeConfig(null)
        setNeedsPracticeSelection(false)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfiles])

  const selectPractice = useCallback(
    async (practiceId: string) => {
      setActivePracticeId(practiceId)
      localStorage.setItem('dentiflow_active_practice', practiceId)
      setNeedsPracticeSelection(false)
      await fetchPractice(practiceId)
    },
    [fetchPractice]
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('dentiflow_active_practice')
    setUser(null)
    setProfiles([])
    setActivePracticeId(null)
    setActivePractice(null)
    setPracticeConfig(null)
    setNeedsPracticeSelection(false)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        profiles,
        activePracticeId,
        activePractice,
        practiceConfig,
        loading,
        needsPracticeSelection,
        selectPractice,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
