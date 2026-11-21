import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'react-hot-toast'
import type { ModuleId } from '@/lib/modules/registry'
import { importableRows, type EntitlementsResponse } from '@/lib/modules/entitlements'
import { migrateStorageKey } from '@/lib/utils/storageMigration'

// One-time key migration for the Finance Now rename — runs before any read below.
migrateStorageKey('caep:entitlements', 'fn:entitlements')

// ─── DB-backed entitlement store (T-083, D234, 2026-11-21) ───────────────────
// Which suite modules the current account has. The server is the truth
// (/api/user/entitlements, over the entitlements table that has existed since
// migration 0000): standard modules are personal on/off toggles synced to the
// account, and Portfolio Builder is granted per account for a real session —
// the owner's command now, billing later (T-084). In local mode (sign-in off,
// today) the server answers with everything togglable and on by default, so
// nothing changes before launch.
//
// localStorage keeps two roles: the pre-hydration fallback (the sidebar renders
// from the saved map until the server answers, so nothing flashes), and the
// WHOLE behaviour when there is no database — a live-only install keeps
// today's browser-only toggles rather than losing the feature.
//
// Core can never be disabled. The interface (isEnabled/setEnabled) is
// unchanged, so Sidebar, ModuleGate, CommandPalette, Headlines and Settings
// read as before.

interface EntitlementState {
  /** The saved browser map: disabled[id] true = off. Fallback + cache. */
  disabled: Partial<Record<ModuleId, boolean>>
  /** True once the saved map has been offered to the server (one-time import). */
  imported: boolean
  /** The server's answer, when it has one. Not persisted. */
  server: EntitlementsResponse | null
}

interface EntitlementActions {
  isEnabled: (id: ModuleId) => boolean
  setEnabled: (id: ModuleId, enabled: boolean) => void
  /** Whether this account's own toggle may change the module. */
  isTogglable: (id: ModuleId) => boolean
  /** Premium modules this account does not hold — locked by grant, not preference. */
  grantLocked: () => ModuleId[]
}

async function api(init?: RequestInit, body?: object): Promise<EntitlementsResponse> {
  const res = await fetch('/api/user/entitlements', {
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    ...init,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.ok) throw new Error(json.error ?? `Request failed (${res.status})`)
  return json as EntitlementsResponse
}

export const useEntitlementStore = create<EntitlementState & EntitlementActions>()(
  persist(
    (set, get) => ({
      disabled: {},
      imported: false,
      server: null,

      isEnabled: (id) => {
        if (id === 'core') return true
        const { server, disabled } = get()
        return server ? server.effective[id] !== false : !disabled[id]
      },

      isTogglable: (id) => {
        if (id === 'core') return false
        const { server } = get()
        // Until the server answers (or where there is no database), every
        // optional module stays togglable — exactly today's behaviour.
        return server ? server.togglable.includes(id) : true
      },

      grantLocked: () => get().server?.grantLocked ?? [],

      setEnabled: (id, enabled) => {
        if (id === 'core' || !get().isTogglable(id)) return
        // Optimistic in both layers: the saved map (so the next load's
        // pre-hydration render is already right) and the server snapshot.
        set((state) => ({
          disabled: { ...state.disabled, [id]: !enabled },
          server: state.server
            ? { ...state.server, effective: { ...state.server.effective, [id]: enabled } }
            : state.server,
        }))
        if (!get().server) return // no database: browser-only, as before
        api({ method: 'PUT' }, { moduleId: id, enabled })
          .then((server) => set({ server }))
          .catch((e: Error) => {
            toast.error(`Module setting not saved: ${e.message}`)
            void hydrateEntitlements()
          })
      },
    }),
    {
      name: 'fn:entitlements',
      // The server snapshot is runtime state; only the fallback map persists.
      partialize: (s) => ({ disabled: s.disabled, imported: s.imported }),
      // Rehydrated explicitly from <Providers> rather than during store
      // creation. Zustand's default is a synchronous read of localStorage as
      // soon as this module is imported, which means the client's very first
      // render already reflects the saved bundle while the server rendered the
      // all-enabled default. Any disabled module then changed the sidebar's
      // section list mid-hydration, React saw mismatched text ("Crypto" vs
      // "Equities"), and threw away the entire server tree to re-render on the
      // client. Deferring the read keeps the first client render identical to
      // the server's; the real state lands an effect later.
      skipHydration: true,
    }
  )
)

/**
 * Ask the server what this account has. Called from <Providers> after the
 * persisted map rehydrates. Quietly keeps the browser-only behaviour when the
 * server cannot answer (no database, or the route unreachable): entitlements
 * are preferences plus grants, and a banner over them would outweigh them.
 */
export async function hydrateEntitlements(): Promise<void> {
  try {
    let server = await api()
    const { disabled, imported } = useEntitlementStore.getState()
    if (!imported) {
      // One-time import of the browser's old toggles: only modules turned OFF
      // need a row, and only ones this mode may toggle (a saved "builder off"
      // on a real account is dropped rather than written over grant rows).
      for (const row of importableRows(disabled, server.mode)) {
        server = await api({ method: 'PUT' }, row)
      }
      useEntitlementStore.setState({ imported: true })
    }
    useEntitlementStore.setState({ server })
  } catch {
    // No database or no route: the persisted map stays the behaviour.
  }
}
