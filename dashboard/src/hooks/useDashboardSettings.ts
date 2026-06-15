import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Owner-facing dashboard inputs that have no live source:
//  - verified_bookings / verified_as_of: manual Dentrix cross-ref booking total
//  - avg_patient_value: used to turn bookings into "revenue recovered"
export interface DashboardSettings {
  verified_bookings?: number
  verified_as_of?: string
  avg_patient_value?: number
}

interface UseDashboardSettingsResult {
  settings: DashboardSettings
  loading: boolean
  error: string | null
  save: (patch: Partial<DashboardSettings>) => Promise<boolean>
}

export function useDashboardSettings(practiceId: string): UseDashboardSettingsResult {
  const [settings, setSettings] = useState<DashboardSettings>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!practiceId) return
    let cancelled = false

    async function fetchSettings() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('dashboard_settings')
        .select('settings')
        .eq('practice_id', practiceId)
        .maybeSingle()

      if (cancelled) return
      if (err) {
        setError(err.message)
      } else {
        setSettings((data?.settings as DashboardSettings) ?? {})
        setError(null)
      }
      setLoading(false)
    }

    fetchSettings()
    return () => {
      cancelled = true
    }
  }, [practiceId])

  const save = useCallback(
    async (patch: Partial<DashboardSettings>) => {
      const next = { ...settings, ...patch }
      const { error: err } = await supabase
        .from('dashboard_settings')
        .upsert(
          { practice_id: practiceId, settings: next, updated_at: new Date().toISOString() },
          { onConflict: 'practice_id' }
        )
      if (err) {
        setError(err.message)
        return false
      }
      setSettings(next)
      setError(null)
      return true
    },
    [practiceId, settings]
  )

  return { settings, loading, error, save }
}
