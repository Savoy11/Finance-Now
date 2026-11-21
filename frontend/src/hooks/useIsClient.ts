'use client'

import { useSyncExternalStore } from 'react'

const noSubscription = () => () => {}

/**
 * False on the server and while the page hydrates, true after. For state only
 * the browser has, such as price alerts kept in its storage: drawing it before
 * this is true would make the browser's first render disagree with the
 * server's, and setting a flag in an effect costs an extra render.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(noSubscription, () => true, () => false)
}
