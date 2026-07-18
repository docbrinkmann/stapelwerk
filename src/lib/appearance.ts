/**
 * Appearance preferences (accent color + font size) persisted in localStorage
 * and applied to the document root, so they take effect app-wide — not only on
 * the settings page. Theme itself is handled by next-themes.
 */

export const ACCENTS = [
  { name: 'zinc', color: '#71717a' },
  { name: 'slate', color: '#64748b' },
  { name: 'stone', color: '#78716c' },
  { name: 'red', color: '#ef4444' },
  { name: 'orange', color: '#f97316' },
  { name: 'green', color: '#22c55e' },
  { name: 'blue', color: '#3b82f6' },
  { name: 'violet', color: '#8b5cf6' },
] as const

export type AccentName = (typeof ACCENTS)[number]['name']

export const FONT_SIZES: Record<string, string> = {
  small: '14px',
  default: '16px',
  large: '18px',
}

export const ACCENT_KEY = 'bms-accent'
export const FONT_SIZE_KEY = 'bms-font-size'

/** Override the --primary/--ring design tokens, or clear back to the default. */
export function applyAccent(name: string | null): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const accent = ACCENTS.find((a) => a.name === name)
  if (accent) {
    root.style.setProperty('--primary', accent.color)
    root.style.setProperty('--ring', accent.color)
  } else {
    root.style.removeProperty('--primary')
    root.style.removeProperty('--ring')
  }
}

/** Scale the whole app by changing the root font size (rem-based sizing). */
export function applyFontSize(size: string): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.fontSize = FONT_SIZES[size] ?? FONT_SIZES.default
}

/** Read persisted prefs and apply them. Safe to call on every app load. */
export function loadAppearancePrefs(): void {
  if (typeof window === 'undefined') return
  applyAccent(localStorage.getItem(ACCENT_KEY))
  applyFontSize(localStorage.getItem(FONT_SIZE_KEY) ?? 'default')
}
