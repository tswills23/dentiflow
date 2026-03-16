export interface BrandingConfig {
  logo_url?: string | null
  primary_color?: string
  accent_color?: string
  sidebar_bg?: string
  sidebar_text?: string
  login_headline?: string
  practice_display_name?: string
}

export const DEFAULT_BRANDING: Required<Omit<BrandingConfig, 'logo_url'>> & { logo_url: null } = {
  logo_url: null,
  primary_color: '#34D399',
  accent_color: '#34D399',
  sidebar_bg: '#151A1F',
  sidebar_text: '#E8ECF0',
  login_headline: 'AI Practice Engine',
  practice_display_name: 'DentiFlow',
}
