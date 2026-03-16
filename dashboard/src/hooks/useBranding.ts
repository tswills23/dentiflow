import { useEffect, useMemo } from 'react'
import { generateShades } from '../utils/colorShades'
import { DEFAULT_BRANDING, type BrandingConfig } from '../types/branding'

export interface ResolvedBranding {
  logo_url: string | null
  login_headline: string
  practice_display_name: string
  primaryColor: string
}

export function useBranding(
  practiceConfig: Record<string, unknown> | null
): ResolvedBranding {
  const merged = useMemo<BrandingConfig>(() => {
    const raw = (practiceConfig?.branding as BrandingConfig) || {}
    return { ...DEFAULT_BRANDING, ...raw }
  }, [practiceConfig])

  useEffect(() => {
    const root = document.documentElement.style

    // Primary shades
    const primaryShades = generateShades(merged.primary_color!)
    root.setProperty('--color-primary', merged.primary_color!)
    for (const [shade, hex] of Object.entries(primaryShades)) {
      root.setProperty(`--color-primary-${shade}`, hex)
    }

    // Accent shades
    const accentShades = generateShades(merged.accent_color!)
    root.setProperty('--color-accent', merged.accent_color!)
    for (const [shade, hex] of Object.entries(accentShades)) {
      root.setProperty(`--color-accent-${shade}`, hex)
    }

    // Sidebar
    root.setProperty('--color-sidebar-bg', merged.sidebar_bg!)
    root.setProperty('--color-sidebar-text', merged.sidebar_text!)

    // If practice has custom branding, override the Midnight theme accent
    if (practiceConfig?.branding) {
      const branding = practiceConfig.branding as BrandingConfig
      if (branding.primary_color) {
        root.setProperty('--accent', branding.primary_color)
        root.setProperty('--accent-dim', branding.primary_color + '1F')
        root.setProperty('--accent-dark', primaryShades['700'] || branding.primary_color)
      }
      if (branding.sidebar_bg) {
        root.setProperty('--bg-surface', branding.sidebar_bg)
      }
    }
  }, [merged, practiceConfig])

  return {
    logo_url: merged.logo_url ?? null,
    login_headline: merged.login_headline!,
    practice_display_name: merged.practice_display_name!,
    primaryColor: merged.primary_color!,
  }
}
