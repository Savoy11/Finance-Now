'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { Bell, Check, GitCompareArrows, Plus, Sparkles, Star } from 'lucide-react'
import { hydrateWatchlists, useWatchlistStore } from '@/store/useWatchlistStore'
import { usePriceAlertStore } from '@/store/usePriceAlertStore'
import {
  NOT_WATCHABLE_NOTE, alertTargetFor, askAiHrefFor, assetPageHref, compareHrefFor, notComparableNote,
  parseAlertPrice, watchKeyFor, type AssetRef,
} from '@/lib/data/assetActions'
import { PriceAlertList, formatAlertPrice } from '@/components/alerts/PriceAlertList'
import { useIsClient } from '@/hooks/useIsClient'

// One row of actions at the top of every coin, stock, fund and macro page
// (T-454, D209): add to a watchlist, set a price alert, open Compare with this
// asset, ask the AI. The rules are in lib/data/assetActions.ts; this draws them.

type Panel = 'watch' | 'alert' | null

const NO_ALERTS: ReturnType<typeof usePriceAlertStore.getState>['alerts'] = []

const BUTTON = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors'
const OFF = 'border-border bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-border-hover'
const ON = 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue'
const DISABLED = 'border-border bg-bg-elevated text-text-muted opacity-60 cursor-not-allowed'

export function AssetActions({ asset, livePrice = null }: {
  asset: AssetRef
  /** The page's live price in dollars, or null where it has none (a reference price is not one). */
  livePrice?: number | null
}) {
  const uid = useId()
  const [panel, setPanel] = useState<Panel>(null)
  const toggle = (p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p))

  const watchKey = watchKeyFor(asset)
  const alertTarget = alertTargetFor(asset)
  const compareHref = compareHrefFor(asset)

  const lists = useWatchlistStore((s) => s.lists)
  useEffect(() => { if (watchKey) void hydrateWatchlists() }, [watchKey])
  const watchingIn = watchKey ? lists.filter((l) => l.keys.includes(watchKey)).length : 0

  // Alerts are kept in this browser, so they are counted only once it has the page.
  const isClient = useIsClient()
  const storedAlerts = usePriceAlertStore((s) => s.alerts)
  const allAlerts = isClient ? storedAlerts : NO_ALERTS
  const alertKind = alertTarget?.kind
  const alertId = alertTarget?.target
  const alerts = useMemo(
    () => (alertKind ? allAlerts.filter((a) => a.kind === alertKind && a.target === alertId) : []),
    [allAlerts, alertKind, alertId],
  )
  const armed = alerts.filter((a) => a.triggeredAt === null).length

  return (
    <section aria-label={`Actions for ${asset.symbol}`} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {watchKey ? (
          <button type="button" onClick={() => toggle('watch')} aria-expanded={panel === 'watch'} aria-controls={`${uid}-watch`}
            className={clsx(BUTTON, watchingIn > 0 || panel === 'watch' ? ON : OFF)}>
            <Star size={13} aria-hidden className={watchingIn > 0 ? 'fill-current' : undefined} />
            {watchingIn > 0 ? `Watching${watchingIn > 1 ? ` (${watchingIn} lists)` : ''}` : 'Add to watchlist'}
          </button>
        ) : (
          <span className={clsx(BUTTON, DISABLED)} aria-disabled="true" title={NOT_WATCHABLE_NOTE}>
            <Star size={13} aria-hidden /> Add to watchlist<span className="sr-only">: {NOT_WATCHABLE_NOTE}</span>
          </span>
        )}

        {alertTarget && (
          <button type="button" onClick={() => toggle('alert')} aria-expanded={panel === 'alert'} aria-controls={`${uid}-alert`}
            className={clsx(BUTTON, armed > 0 || panel === 'alert' ? ON : OFF)}>
            <Bell size={13} aria-hidden />
            {armed > 0 ? `${armed} price alert${armed > 1 ? 's' : ''} set` : 'Set a price alert'}
          </button>
        )}

        {compareHref ? (
          <Link href={compareHref} className={clsx(BUTTON, OFF)}>
            <GitCompareArrows size={13} aria-hidden /> Compare
          </Link>
        ) : (
          <span className={clsx(BUTTON, DISABLED)} aria-disabled="true" title={notComparableNote(asset)}>
            <GitCompareArrows size={13} aria-hidden /> Compare<span className="sr-only">: {notComparableNote(asset)}</span>
          </span>
        )}

        <Link href={askAiHrefFor(asset)}
          className={clsx(BUTTON, 'border-violet-500/40 bg-violet-600 text-white hover:bg-violet-500')}
          title="Opens Research with a question about this asset typed in; nothing runs until you press Run">
          <Sparkles size={13} aria-hidden /> Ask the AI
        </Link>
      </div>

      {panel === 'watch' && watchKey && <WatchPanel id={`${uid}-watch`} watchKey={watchKey} />}
      {panel === 'alert' && alertTarget && (
        <AlertPanel id={`${uid}-alert`} asset={asset} target={alertTarget} livePrice={livePrice} alerts={alerts} />
      )}
    </section>
  )
}

function WatchPanel({ id, watchKey }: { id: string; watchKey: string }) {
  const { lists, hydrated, syncError, createList, addKey, removeKey } = useWatchlistStore()
  const [name, setName] = useState('')

  const newList = () => {
    const listName = name.trim() || 'My watchlist'
    const listId = createList(listName)
    addKey(listId, watchKey)
    setName('')
  }

  return (
    <div id={id} className="rounded-card border border-border bg-bg-card p-3 space-y-2 max-w-md">
      <p className="text-xs font-medium text-text-secondary">Which lists hold it</p>
      {!hydrated ? (
        <p className="text-xs text-text-muted">Loading your watchlists…</p>
      ) : (
        <>
          {syncError && <p className="text-xs text-amber-400">Watchlists could not be loaded: {syncError}</p>}
          {lists.length > 0 && (
            <ul className="space-y-1">
              {lists.map((l) => {
                const has = l.keys.includes(watchKey)
                return (
                  <li key={l.id}>
                    <button type="button" aria-pressed={has}
                      onClick={() => (has ? removeKey(l.id, watchKey) : addKey(l.id, watchKey))}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs text-text-primary hover:bg-bg-elevated">
                      <span className={clsx('flex size-4 items-center justify-center rounded-sm border',
                        has ? 'border-accent-blue bg-accent-blue text-white' : 'border-border')}>
                        {has && <Check size={11} aria-hidden />}
                      </span>
                      {l.name}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); newList() }}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
              placeholder={lists.length === 0 ? 'My watchlist' : 'New list name'}
              aria-label="Name for a new watchlist"
              className="min-w-0 flex-1 rounded-sm border border-border bg-bg-elevated px-2 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-blue/50 focus:outline-hidden" />
            <button type="submit" className="inline-flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary">
              <Plus size={12} aria-hidden /> {lists.length === 0 ? 'Create a list with it' : 'New list with it'}
            </button>
          </form>
          <Link href="/watchlist" className="inline-block text-xs text-accent-blue hover:underline">Open the Watchlist page</Link>
        </>
      )}
    </div>
  )
}

function AlertPanel({ id, asset, target, livePrice, alerts }: {
  id: string
  asset: AssetRef
  target: NonNullable<ReturnType<typeof alertTargetFor>>
  livePrice: number | null
  alerts: ReturnType<typeof usePriceAlertStore.getState>['alerts']
}) {
  const addAlert = usePriceAlertStore((s) => s.addAlert)
  const [condition, setCondition] = useState<'above' | 'below'>('above')
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Read when the form opens, which is always after a click in the browser, so the
  // server never renders this and the first render cannot disagree with it.
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission),
  )

  const add = () => {
    const price = parseAlertPrice(raw)
    if (price === null) { setError('Type a price above zero, in dollars.'); return }
    addAlert({ kind: target.kind, target: target.target, label: asset.name || asset.symbol, href: assetPageHref(asset), condition, price })
    setRaw('')
    setError(null)
  }

  const askPermission = async () => {
    if (typeof Notification === 'undefined') return
    try { setPermission(await Notification.requestPermission()) } catch { /* blocked */ }
  }

  return (
    <div id={id} className="rounded-card border border-border bg-bg-card p-3 space-y-3 max-w-xl">
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); add() }}>
        <label className="text-xs text-text-secondary">
          <span className="block mb-1">Tell me when the price</span>
          <select value={condition} onChange={(e) => setCondition(e.target.value as 'above' | 'below')}
            className="rounded-sm border border-border bg-bg-elevated px-2 py-1 text-xs text-text-primary">
            <option value="above">rises above</option>
            <option value="below">falls below</option>
          </select>
        </label>
        <label className="text-xs text-text-secondary">
          <span className="block mb-1">Price, in dollars</span>
          <input value={raw} onChange={(e) => { setRaw(e.target.value); setError(null) }} inputMode="decimal"
            placeholder={livePrice != null ? formatAlertPrice(livePrice).slice(1) : '0.00'}
            className="w-32 rounded-sm border border-border bg-bg-elevated px-2 py-1 font-mono text-xs tabular-nums text-text-primary placeholder:text-text-muted focus:border-accent-blue/50 focus:outline-hidden" />
        </label>
        <button type="submit" className="rounded-sm bg-accent-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500">
          Add alert
        </button>
        {livePrice != null && <span className="text-[11px] text-text-muted">Now {formatAlertPrice(livePrice)}</span>}
      </form>
      {error && <p className="text-xs text-red-400" role="alert">{error}</p>}

      <PriceAlertList alerts={alerts} showAsset={false} />

      <div className="space-y-1 text-[11px] leading-relaxed text-text-muted">
        <p>
          An alert checks the price once a minute, and only while Finance Now is open in a browser tab. Alerts are kept
          in this browser, not in your account, so they do not follow you to another device. Each one fires once; re-arm
          it to use it again. All your alerts are listed on the <Link href="/watchlist" className="text-accent-blue hover:underline">Watchlist page</Link>.
        </p>
        {target.kind === 'security' && (
          <p>
            It needs a live quote, which needs a quote provider key (Settings → Integrations): it never fires on a
            stored reference price.{livePrice == null && ' There is no live quote for this one right now, so it cannot fire until there is.'}
          </p>
        )}
        {permission === 'default' && (
          <p>
            It shows a message in the app.{' '}
            <button type="button" onClick={askPermission} className="text-accent-blue hover:underline">Also show browser notifications</button>
          </p>
        )}
        {permission === 'denied' && <p>Browser notifications are blocked for this site, so an alert shows only as a message in the app.</p>}
      </div>
    </div>
  )
}
