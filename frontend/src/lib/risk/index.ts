/**
 * Unified risk framework — public API.
 *
 * Pure TypeScript with no React/Next/API imports, so it can move to a
 * shared @suite/core package unchanged when the multi-app suite lands.
 */
export * from './types'
export * from './normalize'
export * from './engine'
export * from './profiles/equity'
export * from './profiles/optionsTrade'
// './profiles/stakingAdapter' was deleted on 2026-09-25 (D26) — it scored the six
// staking dimensions and had had no live consumer since D14.
export * from './profiles/stablecoin'
export * from './profiles/cryptoAsset'
export * from './profiles/commodity'
export * from './profiles/rateInstrument'
export * from './profiles/currency'
