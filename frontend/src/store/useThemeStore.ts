import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Color-scheme picker. A theme is a set of CSS-variable values defined in
// globals.css under `[data-theme="…"]`; switching is just flipping that
// attribute on <html>, so no rebuild or component change is involved.
//
// All presets are dark variants (owner's choice). To add one: add a palette
// block in globals.css and an entry here — the Settings picker renders from
// THEMES automatically.

export interface ThemeDef {
  id: string
  label: string
  description: string
  /** [background, surface, accent] preview swatch — display only. */
  swatch: [string, string, string]
}

export const THEMES: readonly ThemeDef[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Near-black — the CAEP default',
    swatch: ['#0a0b0e', '#1a1d26', '#3b82f6'],
  },
  {
    id: 'slate',
    label: 'Slate',
    description: 'Softer blue-grey dark',
    swatch: ['#0f172a', '#1e293b', '#3b82f6'],
  },
  {
    id: 'nord',
    label: 'Nord',
    description: 'Muted arctic palette',
    swatch: ['#2e3440', '#3b4252', '#81a1c1'],
  },
  {
    id: 'high-contrast',
    label: 'High Contrast',
    description: 'Maximum legibility',
    swatch: ['#000000', '#141414', '#4d94ff'],
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: ThemeId = 'midnight'
const THEME_IDS = THEMES.map((t) => t.id)

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEME_IDS.includes(value)
}

/** Write the theme to <html data-theme>. Safe to call on the server (no-op). */
export function applyTheme(id: ThemeId) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', id)
}

interface ThemeState {
  theme: ThemeId
}

interface ThemeActions {
  setTheme: (id: ThemeId) => void
}

export const useThemeStore = create<ThemeState & ThemeActions>()(
  persist(
    (set) => ({
      theme: DEFAULT_THEME,
      setTheme: (id) => {
        applyTheme(id)
        set({ theme: id })
      },
    }),
    {
      name: 'caep:theme',
      // Rehydrated explicitly from <Providers>, matching useEntitlementStore:
      // a synchronous read at import time would desync the first client render
      // from the server. An inline script in layout.tsx sets data-theme before
      // paint (no flash); this callback re-applies it once the store hydrates.
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    }
  )
)
