'use client'

import { create } from 'zustand'
import { migrateStorageKey } from '@/lib/utils/storageMigration'

// One-time key migration for the Finance Now rename — runs before any read below.
migrateStorageKey('caep:added-coins', 'fn:added-coins')
migrateStorageKey('caep:dismissed-coins', 'fn:dismissed-coins')


export interface AddedCoin {
  cgId: string
  symbol: string
  name: string
  image: string
  category: string
  price: number
  marketCap: number
  marketCapRank: number
  addedAt: string
  addedBy: 'candidate' | 'manual'
  score?: number
  /**
   * ⚠ LEGACY, WRITE-NEVER. Nothing populates this or `score` any more.
   *
   * Renamed from `recommendation` on 2026-08-18 (item 5b), and then W3-1 cut the
   * composite score itself two days later (2026-08-20) — see the header comment on
   * `live-data/coin-discovery/route.ts`. This comment used to stop at the rename,
   * which read as though new coins still get a band.
   *
   * Both fields are KEPT, and that is deliberate rather than an oversight: coins a
   * user saved before the cut carry these keys in localStorage, this store is the
   * user's own list, and dropping them would silently blank data they already have.
   * RP-6's "no permanently-null fields" rule is about a server-shaped `Asset` that
   * could render a misleading "N/A"; these are the user's saved records and render
   * nowhere. Do not delete them, and do not start writing them.
   */
  profileBand?: string
  notes: string
}

interface CoinDiscoveryStore {
  addedCoins: AddedCoin[]
  dismissedIds: string[]
  addCoin: (coin: AddedCoin) => void
  removeCoin: (cgId: string) => void
  dismissCandidate: (cgId: string) => void
  clearDismissed: () => void
  isAdded: (cgId: string) => boolean
  isDismissed: (cgId: string) => boolean
}

const STORAGE_KEY_ADDED    = 'fn:added-coins'
const STORAGE_KEY_DISMISSED = 'fn:dismissed-coins'

function load<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

function save(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota exceeded */ }
}

export const useCoinDiscoveryStore = create<CoinDiscoveryStore>((set, get) => ({
  addedCoins:   load<AddedCoin[]>(STORAGE_KEY_ADDED, []),
  dismissedIds: load<string[]>(STORAGE_KEY_DISMISSED, []),

  addCoin: (coin) => {
    const next = [...get().addedCoins.filter(c => c.cgId !== coin.cgId), coin]
    save(STORAGE_KEY_ADDED, next)
    set({ addedCoins: next })
  },

  removeCoin: (cgId) => {
    const next = get().addedCoins.filter(c => c.cgId !== cgId)
    save(STORAGE_KEY_ADDED, next)
    set({ addedCoins: next })
  },

  dismissCandidate: (cgId) => {
    const next = [...new Set([...get().dismissedIds, cgId])]
    save(STORAGE_KEY_DISMISSED, next)
    set({ dismissedIds: next })
  },

  clearDismissed: () => {
    save(STORAGE_KEY_DISMISSED, [])
    set({ dismissedIds: [] })
  },

  isAdded:     (cgId) => get().addedCoins.some(c => c.cgId === cgId),
  isDismissed: (cgId) => get().dismissedIds.includes(cgId),
}))
